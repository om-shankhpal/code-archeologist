package com.codearcheologist.dto;

import jakarta.validation.constraints.NotBlank;

public record CodeQuestionRequest(

        @NotBlank(message = "Repository URL is required")
        String repositoryUrl,

        @NotBlank(message = "Question is required")
        String question

) {
}