package com.classpulse.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "app.rabbitmq.enabled", havingValue = "true", matchIfMissing = false)
public class RabbitMQConfig {

    // ── Exchange names ─────────────────────────────────────────────────
    public static final String NOTIFICATIONS_EXCHANGE = "classpulse.notifications";
    public static final String CHATBOT_EXCHANGE = "classpulse.chatbot";
    public static final String GAMIFICATION_EXCHANGE = "classpulse.gamification";
    public static final String CONSULTATION_EXCHANGE = "classpulse.consultation";
    public static final String GROUP_CHAT_EXCHANGE = "classpulse.groupchat";

    // ── Queue names ────────────────────────────────────────────────────
    public static final String NOTIFICATIONS_QUEUE = "classpulse.notifications.queue";
    public static final String CHATBOT_QUEUE = "classpulse.chatbot.queue";
    public static final String GAMIFICATION_QUEUE = "classpulse.gamification.queue";
    public static final String CONSULTATION_QUEUE = "classpulse.consultation.queue";
    public static final String GROUP_CHAT_QUEUE = "classpulse.groupchat.queue";

    // ── Dead-letter infrastructure ─────────────────────────────────────
    public static final String DLX_EXCHANGE = "classpulse.dlx";
    public static final String DLQ_QUEUE = "classpulse.dead-letter.queue";

    // ── Exchanges ──────────────────────────────────────────────────────

    @Bean
    public TopicExchange notificationsExchange() {
        return new TopicExchange(NOTIFICATIONS_EXCHANGE);
    }

    @Bean
    public DirectExchange chatbotExchange() {
        return new DirectExchange(CHATBOT_EXCHANGE);
    }

    @Bean
    public TopicExchange gamificationExchange() {
        return new TopicExchange(GAMIFICATION_EXCHANGE);
    }

    @Bean
    public DirectExchange consultationExchange() {
        return new DirectExchange(CONSULTATION_EXCHANGE);
    }

    @Bean
    public TopicExchange groupChatExchange() {
        return new TopicExchange(GROUP_CHAT_EXCHANGE);
    }

    // ── Queues ─────────────────────────────────────────────────────────
    //
    // Every functional queue is wired with a DLX (dead-letter exchange). If a
    // consumer rejects a message (or the message TTLs out), RabbitMQ routes it to
    // the classpulse.dead-letter.queue instead of silently dropping it. Ops can
    // inspect that queue to surface broken consumers.

    private Queue buildWithDlx(String name) {
        return QueueBuilder.durable(name)
                .withArgument("x-dead-letter-exchange", DLX_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", "dead")
                .build();
    }

    @Bean
    public Queue notificationsQueue() {
        return buildWithDlx(NOTIFICATIONS_QUEUE);
    }

    @Bean
    public Queue chatbotQueue() {
        return buildWithDlx(CHATBOT_QUEUE);
    }

    @Bean
    public Queue gamificationQueue() {
        return buildWithDlx(GAMIFICATION_QUEUE);
    }

    @Bean
    public Queue consultationQueue() {
        return buildWithDlx(CONSULTATION_QUEUE);
    }

    @Bean
    public Queue groupChatQueue() {
        return buildWithDlx(GROUP_CHAT_QUEUE);
    }

    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(DLX_EXCHANGE);
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(DLQ_QUEUE).build();
    }

    @Bean
    public Binding deadLetterBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(deadLetterQueue).to(deadLetterExchange).with("dead");
    }

    // ── Bindings ───────────────────────────────────────────────────────

    @Bean
    public Binding notificationsBinding(Queue notificationsQueue, TopicExchange notificationsExchange) {
        return BindingBuilder.bind(notificationsQueue).to(notificationsExchange).with("user.#");
    }

    @Bean
    public Binding chatbotBinding(Queue chatbotQueue, DirectExchange chatbotExchange) {
        return BindingBuilder.bind(chatbotQueue).to(chatbotExchange).with("conversation");
    }

    @Bean
    public Binding gamificationBinding(Queue gamificationQueue, TopicExchange gamificationExchange) {
        return BindingBuilder.bind(gamificationQueue).to(gamificationExchange).with("student.#");
    }

    @Bean
    public Binding consultationBinding(Queue consultationQueue, DirectExchange consultationExchange) {
        return BindingBuilder.bind(consultationQueue).to(consultationExchange).with("update");
    }

    @Bean
    public Binding groupChatBinding(Queue groupChatQueue, TopicExchange groupChatExchange) {
        return BindingBuilder.bind(groupChatQueue).to(groupChatExchange).with("group.#");
    }

    // ── Message converter & template ───────────────────────────────────

    @Bean
    public MessageConverter jackson2JsonMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         MessageConverter jackson2JsonMessageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jackson2JsonMessageConverter);
        return template;
    }
}
