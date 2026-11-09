package com.codearcheologist.controller;

import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class PineconeTestController {

    private final VectorStore vectorStore;

    public PineconeTestController(VectorStore vectorStore) {
        this.vectorStore = vectorStore;
    }

    @GetMapping("/api/test/pinecone")
    public String testPinecone() {

        Document document = new Document(
                "Code Archeologist Pinecone connection test successful."
        );

        vectorStore.add(List.of(document));

        List<Document> results = vectorStore.similaritySearch(
                "Pinecone connection test"
        );

        return "Pinecone successful! Retrieved documents: " + results.size();
    }
}