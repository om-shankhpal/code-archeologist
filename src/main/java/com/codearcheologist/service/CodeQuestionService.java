package com.codearcheologist.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.document.Document;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class CodeQuestionService {

    private final ChatClient chatClient;
    private final RepositoryRetrievalService retrievalService;

    public CodeQuestionService(
            ChatClient.Builder builder,
            RepositoryRetrievalService retrievalService
    ) {
        this.chatClient = builder.build();
        this.retrievalService = retrievalService;
    }

    public CodeAnswer askQuestion(String repositoryUrl, String question) {

        List<Document> documents =
                retrievalService.searchRelevantCode(
                        question,
                        repositoryUrl
                );

        String context = documents.stream()
                .map(document -> {
                    Map<String, Object> metadata = document.getMetadata();

                    return "File: " + metadata.get("filePath")
                            + "\nCode:\n" + document.getText();
                })
                .reduce("", (first, second) ->
                        first + "\n\n--------------------\n\n" + second
                );

        String answer = chatClient.prompt()
                .system("""
                        You are Code Archeologist, an expert software engineer
                        who analyzes source code repositories.

                        Answer questions using ONLY the provided repository code.

                        Rules:
                        1. Explain the code clearly and accurately.
                        2. Never invent classes, methods, or file paths.
                        3. Mention relevant source file paths in your answer.
                        4. If the provided code does not contain enough
                           information, clearly say so.
                        5. Use code examples when helpful.
                        """)
                .user("""
                        Repository: %s

                        Question: %s

                        Retrieved repository code:

                        %s
                        """.formatted(repositoryUrl, question, context))
                .call()
                .content();

        List<String> sources = documents.stream()
                .map(document ->
                        String.valueOf(document.getMetadata().get("filePath"))
                )
                .distinct()
                .toList();

        return new CodeAnswer(answer, sources);
    }

    public record CodeAnswer(
            String answer,
            List<String> sources
    ) {
    }
}