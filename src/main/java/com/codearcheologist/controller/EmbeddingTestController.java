package com.codearcheologist.controller;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EmbeddingTestController {

    private final EmbeddingModel embeddingModel;

    public EmbeddingTestController(EmbeddingModel embeddingModel) {
        this.embeddingModel = embeddingModel;
    }

    @GetMapping("/api/test/embedding")
    public String testEmbedding() {

        float[] vector = embeddingModel.embed(
                "Code Archeologist analyzes GitHub repositories."
        );

        return "Embedding successful! Dimensions: " + vector.length;
    }
}