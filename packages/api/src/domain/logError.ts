const ERROR_NAMES: Record<string, true> = {
    Error: true,
    TypeError: true,
    RangeError: true,
    SyntaxError: true,
    ReferenceError: true,
    URIError: true,
    EvalError: true,
    AggregateError: true,
    MongoServerError: true,
    MongoNetworkError: true,
    ResponseError: true,
    APIError: true,
};

export interface LogErrorFields {
    errorName: string;
    errorCode?: number;
}

/** Dependency errors can echo documents, prompts, URLs and transcripts, including in message/stack/cause. */
export const logErrorFields = (error: unknown): LogErrorFields => {
    if (!(error instanceof Error)) return { errorName: 'UnknownError' };
    const code = (error as Error & { code?: unknown }).code;

    return {
        errorName: Object.hasOwn(ERROR_NAMES, error.name) ? error.name : 'Error',
        ...(typeof code === 'number' && Number.isFinite(code) ? { errorCode: code } : {}),
    };
};
