import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../lib/lambdas/getProductById';
import { products } from '../lib/lambdas/products';

describe('getProductById Lambda', () => {
    let mockEvent: Partial<APIGatewayProxyEvent>;

    beforeEach(() => {
        // Reset mock event before each test
        mockEvent = {
            pathParameters: {}
        };
    });

    it('should return 400 when productId is missing', async () => {
        const response = await handler(mockEvent as APIGatewayProxyEvent);
        
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body)).toEqual({
            error: 'Bad Request',
            message: 'Product ID is required'
        });
    });

    it('should return 404 when product is not found', async () => {
        mockEvent.pathParameters = { productId: 'non-existent-id' };
        
        const response = await handler(mockEvent as APIGatewayProxyEvent);
        
        expect(response.statusCode).toBe(404);
        expect(JSON.parse(response.body)).toEqual({
            error: 'Not found',
            message: 'Product with ID non-existent-id not found'
        });
    });

    it('should return 200 with product when found', async () => {
        // Assuming first product from products array
        const testProduct = products[0];
        mockEvent.pathParameters = { productId: testProduct.id };
        
        const response = await handler(mockEvent as APIGatewayProxyEvent);
        
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual(testProduct);
    });

    it('should return 500 when an unexpected error occurs', async () => {
        // Mock products.find to throw an error
        jest.spyOn(products, 'find').mockImplementationOnce(() => {
            throw new Error('Unexpected error');
        });

        mockEvent.pathParameters = { productId: 'some-id' };
        
        const response = await handler(mockEvent as APIGatewayProxyEvent);
        
        expect(response.statusCode).toBe(500);
        expect(JSON.parse(response.body)).toEqual({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred'
        });
    });
});
