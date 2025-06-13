import React from 'react';
import ProductCard from './ProductCard';
import { Loader, Box, Text, Group } from '@mantine/core';
import { Product } from '../types';

interface ProductDisplayProps {
  products: Product[];
  loadingStep1: boolean;
  loadingStep2: boolean;
  currentProduct?: Product;
}

const ProductDisplay: React.FC<ProductDisplayProps> = ({
  products,
  loadingStep1,
  loadingStep2,
  currentProduct,
}) => {
  return (
    <Box>
      {loadingStep1 && <Loader size="sm" style={{ marginBottom: '10px' }} />}
      {loadingStep2 && <Loader size="sm" style={{ marginBottom: '10px' }} />}

      {currentProduct && (
        <Box style={{ marginBottom: '20px' }}>
          <Text size="md" fw={700} style={{ marginBottom: '10px' }}>
            Current Product:
          </Text>
          <ProductCard product={currentProduct} />
        </Box>
      )}

      {products.length > 0 && (
        <Box>
          <Text size="md" fw={700} style={{ marginBottom: '10px' }}>
            Alternative Products:
          </Text>
          {products.map((product, index) => (
            <ProductCard key={index} product={product} />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ProductDisplay;
