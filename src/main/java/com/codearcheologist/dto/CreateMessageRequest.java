package com.codearcheologist.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateMessageRequest(
        @NotBlank(message = "Role is required") String role,

        @NotBlank(message = "Message content is required") String content) {
}
