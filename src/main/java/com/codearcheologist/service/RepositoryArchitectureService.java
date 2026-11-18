
package com.codearcheologist.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class RepositoryArchitectureService {

        private static final Logger log = LoggerFactory.getLogger(RepositoryArchitectureService.class);

        private static final int MAX_CONTEXT_CHARACTERS = 20000;
        private static final int MAX_FILE_CHARACTERS = 3000;
        private static final int MAX_SELECTED_FILES = 25;
        private static final int MAX_FILE_TREE_CHARACTERS = 8000;

        private final ChatClient chatClient;
        private final RepositoryIngestionService ingestionService;

        public RepositoryArchitectureService(
                        ChatClient.Builder builder,
                        RepositoryIngestionService ingestionService) {
                this.chatClient = builder.build();
                this.ingestionService = ingestionService;
        }

        public String analyzeArchitecture(String repositoryUrl) {

                long totalStart = System.nanoTime();

                // Stage 1: Repository ingestion
                long ingestionStart = System.nanoTime();

                List<RepositoryIngestionService.RepositoryFile> files = ingestionService
                                .ingestRepository(repositoryUrl);

                log.info("Architecture - Repository ingestion: {} ms, files: {}",
                                elapsedMs(ingestionStart), files.size());

                if (files.isEmpty()) {
                        throw new IllegalStateException(
                                        "No supported source files found in the repository.");
                }

                // Stage 2: Context preparation
                long contextStart = System.nanoTime();

                StringBuilder fileTreeBuilder = new StringBuilder();

                files.stream()
                                .map(RepositoryIngestionService.RepositoryFile::path)
                                .sorted()
                                .limit(250)
                                .forEach(path -> {
                                        if (fileTreeBuilder.length() < MAX_FILE_TREE_CHARACTERS) {
                                                fileTreeBuilder.append(path).append("\n");
                                        }
                                });

                String fileTree = fileTreeBuilder.toString();

                List<RepositoryIngestionService.RepositoryFile> importantFiles = files.stream()
                                .filter(this::isImportantFile)
                                .sorted(
                                                Comparator
                                                                .comparingInt(this::getPriority)
                                                                .thenComparing(
                                                                                RepositoryIngestionService.RepositoryFile::path))
                                .limit(MAX_SELECTED_FILES)
                                .toList();

                StringBuilder context = new StringBuilder();

                for (var file : importantFiles) {

                        if (context.length() >= MAX_CONTEXT_CHARACTERS) {
                                break;
                        }

                        int remaining = MAX_CONTEXT_CHARACTERS - context.length();

                        int contentLength = Math.min(
                                        file.content().length(),
                                        Math.min(MAX_FILE_CHARACTERS, remaining));

                        context.append("\n\nFILE: ")
                                        .append(file.path())
                                        .append("\n")
                                        .append(file.content(), 0, contentLength);
                }

                log.info(
                                "Architecture - Context preparation: {} ms, selected files: {}, context characters: {}, file tree characters: {}",
                                elapsedMs(contextStart),
                                importantFiles.size(),
                                context.length(),
                                fileTree.length());

                // Stage 3: Gemini generation
                long aiStart = System.nanoTime();

                String result = chatClient.prompt()
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
                                                context))
                                .call()
                                .content();

                log.info("Architecture - Gemini generation: {} ms",
                                elapsedMs(aiStart));

                log.info("Architecture - TOTAL execution time: {} ms",
                                elapsedMs(totalStart));

                return result;
        }

        private long elapsedMs(long startTime) {
                return (System.nanoTime() - startTime) / 1_000_000;
        }

        private boolean isImportantFile(
                        RepositoryIngestionService.RepositoryFile file) {

                String path = file.path().toLowerCase(Locale.ROOT);

                return path.endsWith("readme.md")
                                || path.endsWith("pom.xml")
                                || path.endsWith("build.gradle")
                                || path.endsWith("build.gradle.kts")
                                || path.endsWith("settings.gradle")
                                || path.endsWith("settings.gradle.kts")
                                || path.endsWith("package.json")
                                || path.endsWith("requirements.txt")
                                || path.endsWith("pyproject.toml")
                                || path.endsWith("go.mod")
                                || path.endsWith("dockerfile")
                                || path.endsWith("docker-compose.yml")
                                || path.endsWith("application.yml")
                                || path.endsWith("application.yaml")
                                || path.endsWith("application.properties")
                                || path.contains("/controller/")
                                || path.contains("/controllers/")
                                || path.contains("/service/")
                                || path.contains("/services/")
                                || path.contains("/repository/")
                                || path.contains("/repositories/")
                                || path.contains("/config/")
                                || path.contains("/configuration/")
                                || path.contains("/model/")
                                || path.contains("/models/")
                                || path.contains("/entity/")
                                || path.contains("/entities/")
                                || path.contains("/domain/")
                                || path.contains("/route")
                                || path.contains("/api/")
                                || path.contains("/main/")
                                || path.endsWith("application.java")
                                || path.endsWith("app.js")
                                || path.endsWith("app.ts")
                                || path.endsWith("index.js")
                                || path.endsWith("index.ts");
        }

        private int getPriority(
                        RepositoryIngestionService.RepositoryFile file) {

                String path = file.path().toLowerCase(Locale.ROOT);

                // Project documentation and build configuration
                if (path.endsWith("readme.md")) {
                        return 0;
                }

                if (path.endsWith("pom.xml")
                                || path.endsWith("build.gradle")
                                || path.endsWith("build.gradle.kts")
                                || path.endsWith("package.json")
                                || path.endsWith("requirements.txt")
                                || path.endsWith("pyproject.toml")
                                || path.endsWith("go.mod")) {
                        return 1;
                }

                // Application entry points
                if (path.endsWith("application.java")
                                || path.endsWith("app.js")
                                || path.endsWith("app.ts")
                                || path.endsWith("index.js")
                                || path.endsWith("index.ts")
                                || path.contains("/main/")) {
                        return 2;
                }

                // Configuration
                if (path.contains("/config/")
                                || path.contains("/configuration/")
                                || path.endsWith("application.yml")
                                || path.endsWith("application.yaml")
                                || path.endsWith("application.properties")) {
                        return 3;
                }

                // HTTP entry points
                if (path.contains("/controller/")
                                || path.contains("/controllers/")
                                || path.contains("/route")
                                || path.contains("/api/")) {
                        return 4;
                }

                // Business logic
                if (path.contains("/service/")
                                || path.contains("/services/")) {
                        return 5;
                }

                // Data access and domain
                if (path.contains("/repository/")
                                || path.contains("/repositories/")
                                || path.contains("/model/")
                                || path.contains("/models/")
                                || path.contains("/entity/")
                                || path.contains("/entities/")
                                || path.contains("/domain/")) {
                        return 6;
                }

                return 7;
        }
}
