package com.codearcheologist.service;

import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RepositoryIndexingService {

    private static final int BATCH_SIZE = 10;
    private static final long DELAY_BETWEEN_BATCHES_MS = 7000;

    private final RepositoryIngestionService ingestionService;
    private final CodeChunkingService chunkingService;
    private final VectorStore vectorStore;

    public RepositoryIndexingService(
            RepositoryIngestionService ingestionService,
            CodeChunkingService chunkingService,
            VectorStore vectorStore
    ) {
        this.ingestionService = ingestionService;
        this.chunkingService = chunkingService;
        this.vectorStore = vectorStore;
    }

    public IndexingResult indexRepository(String repositoryUrl) {

        List<RepositoryIngestionService.RepositoryFile> files =
                ingestionService.ingestRepository(repositoryUrl);

        List<Document> chunks =
                chunkingService.chunkFiles(files, repositoryUrl);

        int indexedChunks = 0;

        for (int i = 0; i < chunks.size(); i += BATCH_SIZE) {

            int end = Math.min(i + BATCH_SIZE, chunks.size());

            List<Document> batch = chunks.subList(i, end);

            vectorStore.add(batch);

            indexedChunks += batch.size();

            System.out.println(
                    "Indexed " + indexedChunks + " / " + chunks.size() + " chunks"
            );

            if (end < chunks.size()) {
                try {
                    Thread.sleep(DELAY_BETWEEN_BATCHES_MS);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(
                            "Repository indexing was interrupted.",
                            exception
                    );
                }
            }
        }

        return new IndexingResult(files.size(), indexedChunks);
    }

    public record IndexingResult(
            int totalFiles,
            int totalChunks
    ) {
    }
}