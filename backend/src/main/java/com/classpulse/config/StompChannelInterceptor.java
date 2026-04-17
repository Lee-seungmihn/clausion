package com.classpulse.config;

import com.classpulse.domain.studygroup.StudyGroup;
import com.classpulse.domain.studygroup.StudyGroupMember;
import com.classpulse.domain.studygroup.StudyGroupRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Enforces per-frame authentication and per-subscription authorization on the STOMP
 * channel. Without this, a legitimate user could subscribe to other groups' topics
 * and eavesdrop on chats they are not a member of.
 *
 * CONNECT:
 *   - Validates the JWT passed either in Authorization header or in the `token` STOMP header.
 *   - Rejects the connection outright if the token is missing/invalid.
 *
 * SUBSCRIBE to /topic/group-chat/{groupId}:
 *   - Rejects unless the authenticated user is a member of that study group.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StompChannelInterceptor implements ChannelInterceptor {

    private static final String GROUP_CHAT_TOPIC_PREFIX = "/topic/group-chat/";

    private final JwtProvider jwtProvider;
    private final JwtBlocklist jwtBlocklist;
    private final StudyGroupRepository studyGroupRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;

        StompCommand cmd = accessor.getCommand();
        if (cmd == null) return message;

        switch (cmd) {
            case CONNECT -> authenticateConnect(accessor);
            case SUBSCRIBE -> authorizeSubscribe(accessor);
            case SEND -> authorizeSend(accessor);
            default -> { /* no-op */ }
        }
        return message;
    }

    private void authenticateConnect(StompHeaderAccessor accessor) {
        String token = extractToken(accessor);
        if (token == null || !jwtProvider.validateToken(token) || jwtBlocklist.isRevoked(token)) {
            throw new IllegalArgumentException("WebSocket authentication failed");
        }
        Long userId = jwtProvider.extractUserId(token);
        String rolesStr = jwtProvider.extractRoles(token);
        List<SimpleGrantedAuthority> authorities = rolesStr == null ? Collections.emptyList()
                : Arrays.stream(rolesStr.split(","))
                        .filter(s -> !s.isBlank())
                        .map(r -> new SimpleGrantedAuthority(r.startsWith("ROLE_") ? r : "ROLE_" + r))
                        .toList();

        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userId, null, authorities);
        accessor.setUser(auth);
    }

    private void authorizeSubscribe(StompHeaderAccessor accessor) {
        String dest = accessor.getDestination();
        if (dest == null) return;
        if (!dest.startsWith(GROUP_CHAT_TOPIC_PREFIX)) return;

        Long userId = currentUserId(accessor);
        if (userId == null) throw new IllegalArgumentException("Subscription without authentication");

        Long groupId = parseId(dest.substring(GROUP_CHAT_TOPIC_PREFIX.length()));
        if (groupId == null) throw new IllegalArgumentException("Invalid group chat destination");

        if (!userIsGroupMember(groupId, userId)) {
            throw new IllegalArgumentException("Not a member of this study group");
        }
    }

    private void authorizeSend(StompHeaderAccessor accessor) {
        String dest = accessor.getDestination();
        if (dest == null) return;
        // Defense-in-depth for /app/group-chat/{groupId}/send
        if (!dest.startsWith("/app/group-chat/")) return;

        Long userId = currentUserId(accessor);
        if (userId == null) throw new IllegalArgumentException("Unauthenticated send");

        String remainder = dest.substring("/app/group-chat/".length());
        int slash = remainder.indexOf('/');
        Long groupId = parseId(slash > 0 ? remainder.substring(0, slash) : remainder);
        if (groupId == null) throw new IllegalArgumentException("Invalid send destination");

        if (!userIsGroupMember(groupId, userId)) {
            throw new IllegalArgumentException("Not a member of this study group");
        }
    }

    private boolean userIsGroupMember(Long groupId, Long userId) {
        StudyGroup group = studyGroupRepository.findById(groupId).orElse(null);
        if (group == null) return false;
        for (StudyGroupMember member : group.getMembers()) {
            if (member.getStudent() != null && Objects.equals(member.getStudent().getId(), userId)) {
                return true;
            }
        }
        return false;
    }

    /** Accepts either `Authorization: Bearer xxx` (native header) or a `token` native header. */
    private String extractToken(StompHeaderAccessor accessor) {
        String auth = accessor.getFirstNativeHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) return auth.substring(7);
        String tokenHeader = accessor.getFirstNativeHeader("token");
        if (tokenHeader != null && !tokenHeader.isBlank()) return tokenHeader;
        return null;
    }

    private Long currentUserId(StompHeaderAccessor accessor) {
        Principal p = accessor.getUser();
        if (p instanceof UsernamePasswordAuthenticationToken upat && upat.getPrincipal() instanceof Long id) {
            return id;
        }
        return null;
    }

    private static Long parseId(String s) {
        if (s == null || s.isBlank()) return null;
        int slash = s.indexOf('/');
        String head = slash > 0 ? s.substring(0, slash) : s;
        try { return Long.parseLong(head); } catch (NumberFormatException e) { return null; }
    }
}
