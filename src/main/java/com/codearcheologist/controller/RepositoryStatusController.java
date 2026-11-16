
package com.codearcheologist.controller;

import com.codearcheologist.service.RepositoryRetrievalService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/repositories")
public class RepositoryStatusController {

    private final RepositoryRetrievalService retrievalService;

    public RepositoryStatusController(
            RepositoryRetrievalService retrievalService) {
        this.retrievalService = retrievalService;
    }

    @GetMapping("/status")
    public RepositoryStatus checkStatus(
            @RequestParam String repositoryUrl) {
        boolean indexed = retrievalService.isRepositoryIndexed(repositoryUrl);

        return new RepositoryStatus(repositoryUrl, indexed);
    }

    public record RepositoryStatus(
            String repositoryUrl,
            boolean indexed) {
    }
}
