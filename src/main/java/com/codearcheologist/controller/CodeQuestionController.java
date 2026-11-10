package com.codearcheologist.controller;

import com.codearcheologist.dto.CodeQuestionRequest;
import com.codearcheologist.service.CodeQuestionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/repositories")
public class CodeQuestionController {

    private final CodeQuestionService questionService;

    public CodeQuestionController(CodeQuestionService questionService) {
        this.questionService = questionService;
    }

    @PostMapping("/ask")
    public CodeQuestionService.CodeAnswer askQuestion(
            @Valid @RequestBody CodeQuestionRequest request
    ) {
        return questionService.askQuestion(
                request.repositoryUrl(),
                request.question()
        );
    }
}