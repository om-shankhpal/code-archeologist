
package com.codearcheologist.controller;

import com.codearcheologist.dto.RepositoryRequest;
import com.codearcheologist.service.RepositoryArchitectureService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/repositories")
public class RepositoryArchitectureController {

    private final RepositoryArchitectureService architectureService;

    public RepositoryArchitectureController(
            RepositoryArchitectureService architectureService) {
        this.architectureService = architectureService;
    }

    @PostMapping("/architecture")
    public Map<String, String> analyzeArchitecture(
            @Valid @RequestBody RepositoryRequest request) {
        String architecture = architectureService.analyzeArchitecture(
                request.repositoryUrl());

        return Map.of("architecture", architecture);
    }
}
