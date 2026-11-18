
package com.codearcheologist.controller;

import com.codearcheologist.service.CodeFlowAnalysisService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/repositories")
public class CodeFlowAnalysisController {

    private final CodeFlowAnalysisService flowAnalysisService;

    public CodeFlowAnalysisController(
            CodeFlowAnalysisService flowAnalysisService) {
        this.flowAnalysisService = flowAnalysisService;
    }

    @PostMapping("/flow")
    public Map<String, String> analyzeCodeFlow(
            @Valid @RequestBody CodeFlowRequest request) {
        String result = flowAnalysisService.analyzeCodeFlow(
                request.repositoryUrl(),
                request.flowDescription());

        return Map.of("flowAnalysis", result);
    }

    public record CodeFlowRequest(

            @NotBlank(message = "Repository URL is required.") @Pattern(regexp = "^https?://(www\\.)?github\\.com/[^/]+/[^/]+/?(?:\\.git)?$", message = "A valid public GitHub repository URL is required.") String repositoryUrl,

            @NotBlank(message = "Flow description is required.") @Size(max = 500, message = "Flow description must not exceed 500 characters.") String flowDescription

    ) {
    }
}
