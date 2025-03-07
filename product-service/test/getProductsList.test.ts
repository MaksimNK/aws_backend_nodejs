import { handler } from "../lib/lambdas/getProductsList";
import { products } from "../lib/lambdas/products";
import * as utils from "../lib/lambdas/utils";

describe("getProductsList Handler", () => {
    it("should return 200 and the products array", async () => {
        const response = await handler();
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual(products);
    });

    it("should return 500 and error message when an exception is thrown", async () => {
        const errorResponse = {
            error: 'Internal Server Error',
            message: 'An unexpected error occurred',
        };

        const formatResponseSpy = jest
            .spyOn(utils, "formatResponse")
            .mockImplementationOnce(() => {
                throw new Error("Test error");
            });

        const response = await handler();
        expect(response.statusCode).toBe(500);
        expect(JSON.parse(response.body)).toEqual(errorResponse);

        formatResponseSpy.mockRestore();
    });
});
