export class ApiResponse<T> {
    constructor(
        public readonly message: string,
        public readonly data: T | null = null,
        public readonly success: boolean = true
    ) {}
}
