package com.codearcheologist.dto;

import jakarta.validation.constraints.NotBlank;

public record RepositoryRequest(

        @NotBlank(message = "GitHub repository URL is required")
        String repositoryUrl

) {
}