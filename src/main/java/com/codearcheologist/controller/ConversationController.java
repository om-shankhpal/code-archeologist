
package com.codearcheologist.controller;

import com.codearcheologist.dto.ChatMessageResponse;
import com.codearcheologist.dto.ConversationResponse;
import com.codearcheologist.dto.CreateConversationRequest;
import com.codearcheologist.dto.CreateMessageRequest;
import com.codearcheologist.service.ConversationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(
            ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationResponse createConversation(
            @RequestBody CreateConversationRequest request) {
        return conversationService.createConversation(
                request.repositoryUrl());
    }

    @GetMapping
    public List<ConversationResponse> getAllConversations() {
        return conversationService.getAllConversations();
    }

    @GetMapping("/{id}")
    public ConversationResponse getConversation(
            @PathVariable UUID id) {
        return conversationService.getConversation(id);
    }

    @PostMapping("/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public ChatMessageResponse addMessage(
            @PathVariable UUID id,
            @Valid @RequestBody CreateMessageRequest request) {
        return conversationService.addMessage(
                id,
                request.role(),
                request.content());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteConversation(@PathVariable UUID id) {
        conversationService.deleteConversation(id);
    }
}
