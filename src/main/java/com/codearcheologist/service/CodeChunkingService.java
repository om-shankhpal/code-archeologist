package com.codearcheologist.service;

import org.springframework.ai.document.Document;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CodeChunkingService {

    private static final int CHUNK_SIZE = 1200;
    private static final int CHUNK_OVERLAP = 200;

    public List<Document> chunkFiles(
            List<RepositoryIngestionService.RepositoryFile> files,
            String repositoryUrl
    ) {
        List<Document> documents = new ArrayList<>();

        for (RepositoryIngestionService.RepositoryFile file : files) {

            String content = file.content();

            if (content == null || content.isBlank()) {
                continue;
            }

            int start = 0;
            int chunkIndex = 0;

            while (start < content.length()) {

                int end = Math.min(start + CHUNK_SIZE, content.length());

                if (end < content.length()) {
                    int newline = content.lastIndexOf('\n', end);

                    if (newline > start + CHUNK_SIZE / 2) {
                        end = newline + 1;
                    }
                }

                String chunk = content.substring(start, end).trim();

                if (!chunk.isBlank()) {

                    String uniqueKey = repositoryUrl + ":"
                            + file.path() + ":" + chunkIndex;

                    String id = UUID.nameUUIDFromBytes(
                            uniqueKey.getBytes(StandardCharsets.UTF_8)
                    ).toString();

                    Map<String, Object> metadata = new HashMap<>();
                    metadata.put("filePath", file.path());
                    metadata.put("chunkIndex", chunkIndex);
                    metadata.put("repositoryUrl", repositoryUrl);

                    documents.add(new Document(id, chunk, metadata));

                    chunkIndex++;
                }

                if (end >= content.length()) {
                    break;
                }

                start = end - CHUNK_OVERLAP;
            }
        }

        return documents;
    }
}