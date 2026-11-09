package com.codearcheologist.service;

import tools.jackson.databind.JsonNode;
import org.springframework.http.HttpHeaders;
import org.springframework.web.client.RestClient;
import org.springframework.stereotype.Service;

import java.net.URI;

@Service
public class GitHubRepositoryService {

    private final RestClient restClient;

    public GitHubRepositoryService(RestClient.Builder builder) {
        this.restClient = builder
                .baseUrl("https://api.github.com")
                .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
                .defaultHeader(HttpHeaders.USER_AGENT, "Code-Archeologist")
                .build();
    }

    public String getDefaultBranch(String repositoryUrl) {

        URI uri = URI.create(repositoryUrl);

        if (!"github.com".equalsIgnoreCase(uri.getHost())
                && !"www.github.com".equalsIgnoreCase(uri.getHost())) {
            throw new IllegalArgumentException("Only GitHub repository URLs are supported.");
        }

        String[] parts = uri.getPath().split("/");

        if (parts.length < 3) {
            throw new IllegalArgumentException("Invalid GitHub repository URL.");
        }

        String owner = parts[1];
        String repository = parts[2].replaceFirst("\\.git$", "");

        JsonNode response = restClient.get()
                .uri("/repos/{owner}/{repository}", owner, repository)
                .retrieve()
                .body(JsonNode.class);

        if (response == null || response.path("default_branch").isMissingNode()) {
            throw new IllegalStateException("Could not retrieve the repository's default branch.");
        }

        return response.get("default_branch").asText();
    }
}