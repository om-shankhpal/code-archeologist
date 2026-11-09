package com.codearcheologist.controller;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GeminiTestController {

    private final ChatClient chatClient;

    public GeminiTestController(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

    @GetMapping("/api/test/gemini")
    public String testGemini() {

        return chatClient.prompt()
                .user("Reply with: Code Archeologist Gemini connection successful!")
                .call()
                .content();
    }
}