
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
public class CodeFlowAnalysisService {

        private static final Logger log = LoggerFactory.getLogger(CodeFlowAnalysisService.class);

        private static final int MAX_CONTEXT_LENGTH = 20000;
        private static final int MAX_FILE_LENGTH = 3000;
        private static final int MAX_FILES = 25;
        private static final int MAX_FILE_TREE_LENGTH = 8000;

        private final ChatClient chatClient;
        private final RepositoryIngestionService ingestionService;

        public CodeFlowAnalysisService(
                        ChatClient.Builder builder,
                        RepositoryIngestionService ingestionService) {
                this.chatClient = builder.build();
                this.ingestionService = ingestionService;
        }

        public String analyzeCodeFlow(
                        String repositoryUrl,
                        String flowDescription) {

                long totalStart = System.nanoTime();

                // Stage 1: Repository ingestion
                long ingestionStart = System.nanoTime();

                List<RepositoryIngestionService.RepositoryFile> files = ingestionService
                                .ingestRepository(repositoryUrl);

                log.info("Code Flow - Repository ingestion: {} ms, files: {}",
                                elapsedMs(ingestionStart), files.size());

                if (files.isEmpty()) {
                        throw new IllegalStateException(
                                        "No supported source files found in the repository.");
                }

                // Stage 2: Context preparation
                long contextStart = System.nanoTime();

                List<RepositoryIngestionService.RepositoryFile> relevantFiles = files.stream()
                                .filter(this::isRelevantFile)
                                .sorted(
                                                Comparator
                                                                .comparingInt(this::getPriority)
                                                                .thenComparing(
                                                                                RepositoryIngestionService.RepositoryFile::path))
                                .limit(MAX_FILES)
                                .toList();

                StringBuilder fileTreeBuilder = new StringBuilder();

                files.stream()
                                .map(RepositoryIngestionService.RepositoryFile::path)
                                .sorted()
                                .limit(250)
                                .forEach(path -> {
                                        if (fileTreeBuilder.length() < MAX_FILE_TREE_LENGTH) {
                                                fileTreeBuilder.append(path).append("\n");
                                        }
                                });

                String fileTree = fileTreeBuilder.toString();

                StringBuilder context = new StringBuilder();

                for (var file : relevantFiles) {

                        if (context.length() >= MAX_CONTEXT_LENGTH) {
                                break;
                        }

                        int remaining = MAX_CONTEXT_LENGTH - context.length();

                        int contentLength = Math.min(
                                        file.content().length(),
                                        Math.min(MAX_FILE_LENGTH, remaining));

                        context.append("\n\nFILE: ")
                                        .append(file.path())
                                        .append("\n")
                                        .append(file.content(), 0, contentLength);
                }

                log.info(
                                "Code Flow - Context preparation: {} ms, selected files: {}, context characters: {}, file tree characters: {}",
                                elapsedMs(contextStart),
                                relevantFiles.size(),
                                context.length(),
                                fileTree.length());

                // Stage 3: Gemini generation
                long aiStart = System.nanoTime();

                String result = chatClient.prompt()
                                .system("""
                                                You are Code Archeologist, an expert software
                                                engineer specializing in code execution tracing.

                                                Your task is to trace how a requested operation
                                                flows through the supplied repository.

                                                Analyze the actual source code and explain the
                                                execution path from entry point to final operation.

                                                Structure your response using these sections:

                                                1. Flow Overview
                                                2. Entry Point
                                                3. Step-by-Step Execution Flow
                                                4. Classes and Methods Involved
                                                5. Data Flow
                                                6. Database and External Service Interactions
                                                7. Error Handling and Validation
                                                8. Important Observations

                                                Rules:
                                                - Trace only code supported by supplied files.
                                                - Follow actual method calls where possible.
                                                - Identify class names, method names and file paths.
                                                - Explain how data moves between components.
                                                - Do not invent missing methods or execution steps.
                                                - Distinguish confirmed behavior from inference.
                                                - If a part of the flow cannot be verified,
                                                  explicitly mention it.
                                                - If multiple possible flows exist, explain them.
                                                - Use clear, ordered steps.
                                                - Do not assume a service layer exists.
                                                - Do not assume a repository or database is involved.
                                                - Format the response using Markdown.
                                                """)
                                .user("""
                                                REPOSITORY URL:
                                                %s

                                                REQUESTED CODE FLOW:
                                                %s

                                                REPOSITORY FILE TREE:
                                                %s

                                                SOURCE CODE:
                                                %s

                                                Trace the requested operation through the
                                                repository and explain its execution flow.
                                                """.formatted(
                                                repositoryUrl,
                                                flowDescription,
                                                fileTree,
                                                context))
                                .call()
                                .content();

                log.info("Code Flow - Gemini generation: {} ms",
                                elapsedMs(aiStart));

                log.info("Code Flow - TOTAL execution time: {} ms",
                                elapsedMs(totalStart));

                return result;
        }

        private long elapsedMs(long startTime) {
                return (System.nanoTime() - startTime) / 1_000_000;
        }

        private boolean isRelevantFile(
                        RepositoryIngestionService.RepositoryFile file) {
                String path = file.path().toLowerCase(Locale.ROOT);

                return path.endsWith(".java")
                                || path.endsWith(".js")
                                || path.endsWith(".jsx")
                                || path.endsWith(".ts")
                                || path.endsWith(".tsx")
                                || path.endsWith(".py")
                                || path.endsWith(".go")
                                || path.endsWith("pom.xml")
                                || path.endsWith("package.json")
                                || path.endsWith("requirements.txt")
                                || path.endsWith("pyproject.toml")
                                || path.endsWith("go.mod");
        }

        private int getPriority(
                        RepositoryIngestionService.RepositoryFile file) {
                String path = file.path().toLowerCase(Locale.ROOT);

                // HTTP entry points
                if (path.contains("/controller/")
                                || path.contains("/controllers/")
                                || path.contains("/route")
                                || path.contains("/routes/")) {
                        return 1;
                }

                // Business logic
                if (path.contains("/service/")
                                || path.contains("/services/")) {
                        return 2;
                }

                // Persistence
                if (path.contains("/repository/")
                                || path.contains("/repositories/")
                                || path.contains("/dao/")) {
                        return 3;
                }

                // Domain models
                if (path.contains("/model/")
                                || path.contains("/models/")
                                || path.contains("/entity/")
                                || path.contains("/entities/")
                                || path.contains("/domain/")) {
                        return 4;
                }

                // Application configuration
                if (path.contains("/config/")
                                || path.contains("/security/")) {
                        return 5;
                }

                // Build dependencies
                if (path.endsWith("pom.xml")
                                || path.endsWith("package.json")
                                || path.endsWith("requirements.txt")
                                || path.endsWith("pyproject.toml")
                                || path.endsWith("go.mod")) {
                        return 6;
                }

                return 7;
        }
}
