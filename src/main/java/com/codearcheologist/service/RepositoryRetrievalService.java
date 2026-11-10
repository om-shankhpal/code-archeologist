package com.codearcheologist.service;

import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RepositoryRetrievalService {

    private final VectorStore vectorStore;

    public RepositoryRetrievalService(VectorStore vectorStore) {
        this.vectorStore = vectorStore;
    }

    public List<Document> searchRelevantCode(String question) {

        return vectorStore.similaritySearch(
                SearchRequest.builder()
                        .query(question)
                        .topK(5)
                        .build()
        );
    }

    public List<Document> searchRelevantCode(
            String question,
            String repositoryUrl
    ) {
        String safeRepositoryUrl = repositoryUrl.replace("'", "\\'");

        return vectorStore.similaritySearch(
                SearchRequest.builder()
                        .query(question)
                        .topK(5)
                        .filterExpression(
                                "repositoryUrl == '" + safeRepositoryUrl + "'"
                        )
                        .build()
        );
    }
}