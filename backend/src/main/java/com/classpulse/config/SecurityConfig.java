package com.classpulse.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CorsConfigurationSource corsConfigurationSource;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // /api/auth/me requires authentication
                        .requestMatchers("/api/auth/me").authenticated()
                        // Public auth endpoints (login, register)
                        .requestMatchers("/api/auth/**").permitAll()
                        // SSE streaming endpoints (require auth via JWT filter)
                        .requestMatchers("/api/notifications/stream").authenticated()
                        .requestMatchers("/api/chatbot/conversations/*/stream").authenticated()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // WebSocket endpoint (auth via ?token= query param in JwtFilter)
                        .requestMatchers("/ws-chat/**").permitAll()
                        // Health check, error & seed
                        .requestMatchers("/actuator/health", "/error").permitAll()
                        .requestMatchers("/api/seed/**").permitAll()
                        // Instructor endpoints
                        .requestMatchers("/api/instructor/**").hasRole("INSTRUCTOR")
                        // Operator endpoints
                        .requestMatchers("/api/operator/**").hasRole("OPERATOR")
                        // All other endpoints require authentication
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
