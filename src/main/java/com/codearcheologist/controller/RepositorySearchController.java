package com.codearcheologist.controller;

import com.codearcheologist.service.RepositoryRetrievalService;
import org.springframework.ai.document.Document;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/repositories")
public class RepositorySearchController {

    private final RepositoryRetrievalService retrievalService;

    public RepositorySearchController(
            RepositoryRetrievalService retrievalService
    ) {
        this.retrievalService = retrievalService;
    }

    @GetMapping("/search")
    public List<Map<String, Object>> searchRepository(
            @RequestParam String question
    ) {
        List<Document> results =
                retrievalService.searchRelevantCode(question);

        return results.stream()
                .map(document -> Map.<String, Object>of(
                        "content", document.getText(),
                        "metadata", document.getMetadata()
                ))
                .toList();
    }
}