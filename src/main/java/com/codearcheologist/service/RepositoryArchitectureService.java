
package com.codearcheologist.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class RepositoryArchitectureService {

    private final ChatClient chatClient;
    private final RepositoryIngestionService ingestionService;

    public RepositoryArchitectureService(
            ChatClient.Builder builder,
            RepositoryIngestionService ingestionService
    ) {
        this.chatClient = builder.build();
        this.ingestionService = ingestionService;
    }

    public String analyzeArchitecture(String repositoryUrl) {

        List<RepositoryIngestionService.RepositoryFile> files =
                ingestionService.ingestRepository(repositoryUrl);

        if (files.isEmpty()) {
            throw new IllegalStateException(
                    "No supported source files found in the repository."
            );
        }

        String fileTree = files.stream()
                .map(RepositoryIngestionService.RepositoryFile::path)
                .sorted()
                .limit(500)
                .collect(Collectors.joining("\n"));

        List<RepositoryIngestionService.RepositoryFile> importantFiles =
                files.stream()
                        .filter(this::isImportantFile)
                        .sorted(Comparator.comparingInt(this::getPriority))
                        .limit(35)
                        .toList();

        StringBuilder context = new StringBuilder();

        for (var file : importantFiles) {

            if (context.length() >= 45000) {
                break;
            }

            int remaining = 45000 - context.length();
            int contentLength = Math.min(
                    file.content().length(),
                    Math.min(6000, remaining)
            );

            context.append("\n\nFILE: ")
                    .append(file.path())
                    .append("\n")
                    .append(file.content(), 0, contentLength);
        }

        return chatClient.prompt()
                .system("""
                        You are Code Archeologist, an expert software
                        architect and senior software engineer.

                        Analyze the provided GitHub repository and
                        generate a comprehensive architecture overview.

                        Structure your response using these sections:

                        1. Project Overview
                        2. Technology Stack
                        3. Project Directory Structure
                        4. Main Entry Points
                        5. Important Modules and Responsibilities
                        6. Module Interactions
                        7. Application Execution Flow
                        8. External Dependencies and Integrations
                        9. Architectural Patterns

                        Rules:
                        - Use only the supplied repository information.
                        - Never invent files, classes, or dependencies.
                        - Explain how components communicate.
                        - Reference actual file paths wherever possible.
                        - Distinguish confirmed facts from reasonable
                          architectural inferences.
                        - If information is unavailable, say so.
                        - Format the response using Markdown.
                        """)
                .user("""
                        Repository URL: %s

                        REPOSITORY FILE TREE:
                        %s

                        IMPORTANT SOURCE FILES:
                        %s

                        Generate the repository architecture overview.
                        """.formatted(
                        repositoryUrl,
                        fileTree,
                        context
                ))
                .call()
                .content();
    }

    private boolean isImportantFile(
            RepositoryIngestionService.RepositoryFile file
    ) {
        String path = file.path().toLowerCase(Locale.ROOT);

        return path.endsWith("readme.md")
                || path.endsWith("pom.xml")
                || path.endsWith("build.gradle")
                || path.endsWith("build.gradle.kts")
                || path.endsWith("package.json")
                || path.endsWith("requirements.txt")
                || path.endsWith("pyproject.toml")
                || path.endsWith("go.mod")
                || path.endsWith("dockerfile")
                || path.endsWith("docker-compose.yml")
                || path.contains("/main/")
                || path.contains("/controller/")
                || path.contains("/service/")
                || path.contains("/config/")
                || path.contains("/route")
                || path.contains("/api/")
                || path.endsWith("application.java")
                || path.endsWith("app.js")
                || path.endsWith("app.ts");
    }

    private int getPriority(
            RepositoryIngestionService.RepositoryFile file
    ) {
        String path = file.path().toLowerCase(Locale.ROOT);

        if (path.endsWith("readme.md")) return 0;

        if (path.endsWith("pom.xml")
                || path.endsWith("build.gradle")
                || path.endsWith("package.json")) return 1;

        if (path.contains("application")
                || path.contains("/main/")) return 2;

        if (path.contains("/config/")) return 3;

        if (path.contains("/controller/")
                || path.contains("/route")) return 4;

        if (path.contains("/service/")) return 5;

        return 6;
    }
}
