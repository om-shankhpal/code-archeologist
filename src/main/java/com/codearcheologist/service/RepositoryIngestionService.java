package com.codearcheologist.service;

import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.List;

@Service
public class RepositoryIngestionService {

    private final GitHubRepositoryService repositoryService;
    private final GitHubContentService contentService;

    public RepositoryIngestionService(
            GitHubRepositoryService repositoryService,
            GitHubContentService contentService
    ) {
        this.repositoryService = repositoryService;
        this.contentService = contentService;
    }

    public List<RepositoryFile> ingestRepository(String repositoryUrl) {

        URI uri = URI.create(repositoryUrl);

        if (!"github.com".equalsIgnoreCase(uri.getHost())
                && !"www.github.com".equalsIgnoreCase(uri.getHost())) {
            throw new IllegalArgumentException(
                    "Only GitHub repository URLs are supported."
            );
        }

        String[] parts = uri.getPath().split("/");

        if (parts.length < 3) {
            throw new IllegalArgumentException(
                    "Invalid GitHub repository URL."
            );
        }

        String owner = parts[1];
        String repository = parts[2].replaceFirst("\\.git$", "");

        String branch = repositoryService.getDefaultBranch(repositoryUrl);

        List<GitHubContentService.RepositoryFile> downloadedFiles =
                contentService.getRepositoryContents(owner, repository, branch);

        return downloadedFiles.stream()
                .map(file -> new RepositoryFile(file.path(), file.content()))
                .toList();
    }

    public record RepositoryFile(String path, String content) {
    }
}