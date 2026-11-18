
package com.codearcheologist.service;

import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RepositoryIngestionService {

    private static final long CACHE_DURATION_MS =
            30 * 60 * 1000L;

    private final GitHubRepositoryService repositoryService;
    private final GitHubContentService contentService;

    private final Map<String, CachedRepository> cache =
            new ConcurrentHashMap<>();

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

        String cacheKey = owner + "/" + repository + "/" + branch;

        CachedRepository cached = cache.get(cacheKey);

        if (cached != null
                && System.currentTimeMillis() - cached.cachedAt()
                < CACHE_DURATION_MS) {
            return cached.files();
        }

        List<RepositoryFile> files = contentService
                .getRepositoryContents(owner, repository, branch)
                .stream()
                .map(file -> new RepositoryFile(
                        file.path(),
                        file.content()
                ))
                .toList();

        cache.put(cacheKey, new CachedRepository(
                files,
                System.currentTimeMillis()
        ));

        return files;
    }

    private record CachedRepository(
            List<RepositoryFile> files,
            long cachedAt
    ) {
    }

    public record RepositoryFile(String path, String content) {
    }
}
