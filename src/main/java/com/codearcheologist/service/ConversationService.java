
package com.codearcheologist.service;

import com.codearcheologist.dto.ChatMessageResponse;
import com.codearcheologist.dto.ConversationResponse;
import com.codearcheologist.model.ChatMessage;
import com.codearcheologist.model.Conversation;
import com.codearcheologist.repository.ChatMessageRepository;
import com.codearcheologist.repository.ConversationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;

    public ConversationService(
            ConversationRepository conversationRepository,
            ChatMessageRepository messageRepository
    ) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    @Transactional
    public ConversationResponse createConversation(String repositoryUrl) {
        Conversation conversation = new Conversation();
        conversation.setRepositoryUrl(repositoryUrl);

        Conversation saved = conversationRepository.save(conversation);

        return toResponse(saved, List.of());
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> getAllConversations() {
        return conversationRepository.findAllByOrderByUpdatedAtDesc()
                .stream()
                .map(conversation -> toResponse(conversation, List.of()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ConversationResponse getConversation(UUID id) {
        Conversation conversation = findConversation(id);

        List<ChatMessageResponse> messages =
                messageRepository
                        .findByConversationIdOrderByCreatedAtAsc(id)
                        .stream()
                        .map(this::toMessageResponse)
                        .toList();

        return toResponse(conversation, messages);
    }

    @Transactional
    public ChatMessageResponse addMessage(
            UUID conversationId,
            String role,
            String content
    ) {
        Conversation conversation = findConversation(conversationId);

        String normalizedRole = role.trim().toLowerCase();

        if (!normalizedRole.equals("user")
                && !normalizedRole.equals("assistant")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Role must be either user or assistant"
            );
        }

        ChatMessage message = new ChatMessage(
                conversation,
                normalizedRole,
                content.trim()
        );

        ChatMessage savedMessage = messageRepository.save(message);

        if (normalizedRole.equals("user")
                && "New chat".equals(conversation.getTitle())) {

            String title = content.trim();

            if (title.length() > 35) {
                title = title.substring(0, 35) + "...";
            }

            conversation.setTitle(title);
        }

        conversation.touch();
        conversationRepository.save(conversation);

        return toMessageResponse(savedMessage);
    }

    @Transactional
    public void deleteConversation(UUID id) {
        Conversation conversation = findConversation(id);

        messageRepository.deleteByConversationId(id);
        conversationRepository.delete(conversation);
    }

    private Conversation findConversation(UUID id) {
        return conversationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Conversation not found"
                ));
    }

    private ChatMessageResponse toMessageResponse(ChatMessage message) {
        return new ChatMessageResponse(
                message.getId(),
                message.getRole(),
                message.getContent(),
                message.getCreatedAt()
        );
    }

    private ConversationResponse toResponse(
            Conversation conversation,
            List<ChatMessageResponse> messages
    ) {
        return new ConversationResponse(
                conversation.getId(),
                conversation.getTitle(),
                conversation.getRepositoryUrl(),
                conversation.getCreatedAt(),
                conversation.getUpdatedAt(),
                messages
        );
    }
}
