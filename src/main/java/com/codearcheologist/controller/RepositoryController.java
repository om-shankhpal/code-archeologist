package com.codearcheologist.controller;

import com.codearcheologist.dto.RepositoryRequest;
import com.codearcheologist.service.RepositoryIndexingService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/repositories")
public class RepositoryController {

    private final RepositoryIndexingService indexingService;

    public RepositoryController(RepositoryIndexingService indexingService) {
        this.indexingService = indexingService;
    }

    @PostMapping("/ingest")
    public IngestionResponse ingestRepository(
            @Valid @RequestBody RepositoryRequest request
    ) {
        RepositoryIndexingService.IndexingResult result =
                indexingService.indexRepository(request.repositoryUrl());

        return new IngestionResponse(
                "Repository successfully indexed in Pinecone!",
                result.totalFiles(),
                result.totalChunks()
        );
    }

    public record IngestionResponse(
            String message,
            int totalFiles,
            int totalChunks
    ) {
    }
}