package com.codearcheologist.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
public class GitHubContentService {

    private final RestClient restClient;

    public GitHubContentService(RestClient.Builder builder) {
        this.restClient = builder
                .baseUrl("https://codeload.github.com")
                .defaultHeader("User-Agent", "Code-Archeologist")
                .build();
    }

    public List<RepositoryFile> getRepositoryContents(
            String owner,
            String repository,
            String branch
    ) {
        byte[] zipBytes = restClient.get()
                .uri("/{owner}/{repository}/zip/refs/heads/{branch}",
                        owner, repository, branch)
                .retrieve()
                .body(byte[].class);

        if (zipBytes == null || zipBytes.length == 0) {
            throw new IllegalStateException("Could not download repository ZIP.");
        }

        List<RepositoryFile> files = new ArrayList<>();

        try (ZipInputStream zipInputStream =
                     new ZipInputStream(new ByteArrayInputStream(zipBytes))) {

            ZipEntry entry;

            while ((entry = zipInputStream.getNextEntry()) != null) {

                if (!entry.isDirectory() && isSupportedFile(entry.getName())) {

                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    zipInputStream.transferTo(output);

                    String content = output.toString(StandardCharsets.UTF_8);

                    String[] pathParts = entry.getName().split("/", 2);

                    if (pathParts.length == 2 && !content.isBlank()) {
                        files.add(new RepositoryFile(pathParts[1], content));
                    }
                }

                zipInputStream.closeEntry();
            }

        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Could not extract repository ZIP.",
                    exception
            );
        }

        return files;
    }

    private boolean isSupportedFile(String path) {
        String lowerPath = path.toLowerCase();

        return lowerPath.endsWith(".java")
                || lowerPath.endsWith(".js")
                || lowerPath.endsWith(".jsx")
                || lowerPath.endsWith(".ts")
                || lowerPath.endsWith(".tsx")
                || lowerPath.endsWith(".py")
                || lowerPath.endsWith(".go")
                || lowerPath.endsWith(".html")
                || lowerPath.endsWith(".css")
                || lowerPath.endsWith(".xml")
                || lowerPath.endsWith(".json")
                || lowerPath.endsWith(".yml")
                || lowerPath.endsWith(".yaml")
                || lowerPath.endsWith(".md")
                || lowerPath.endsWith(".properties")
                || lowerPath.endsWith(".sql");
    }

    public record RepositoryFile(String path, String content) {
    }
}