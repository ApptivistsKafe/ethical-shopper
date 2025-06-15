import React from 'react';
import { Card, Image, Text, Badge, Group, HoverCard, Box } from '@mantine/core';
import { Smile, Meh, CircleHelp, Frown, Laugh, Angry } from 'lucide-react';
import { Product } from '../types';
import { EthicalStatus, getEthicalStatusColor } from '../constants/ethicalStatus';

interface ProductCardProps {
  product: Product;
  denomination?: string;
}

export const getEthicalIconBadge = (status: string) => {
  const statusLower = status?.toLowerCase();
  let icon;

  const bgColor = getEthicalStatusColor(statusLower);

  if (!status) {
    icon = <CircleHelp size={14} style={{ color: 'grey', fill: bgColor }} />;
  } else if (statusLower.startsWith(EthicalStatus.Excellent.toLowerCase())) {
    icon = <Laugh size={14} style={{ color: 'green', fill: bgColor }} />;
  } else if (statusLower.startsWith(EthicalStatus.Good.toLowerCase())) {
    icon = <Smile size={14} style={{ color: 'yellowgreen', fill: bgColor }} />;
  } else if (statusLower.startsWith(EthicalStatus.Concerning.toLowerCase())) {
    icon = <Frown size={14} style={{ color: 'orangered', fill: bgColor }} />;
  } else if (statusLower.startsWith(EthicalStatus.Mixed.toLowerCase())) {
    icon = <Meh size={14} style={{ color: 'darkgoldenrod', fill: bgColor }} />;
  } else if (statusLower.startsWith(EthicalStatus.Poor.toLowerCase())) {
    icon = <Angry size={14} style={{ color: 'red', fill: bgColor }} />;
  } else {
    icon = <Meh size={14} style={{ color: 'grey', fill: bgColor }} />; // Default for unknown status
  }

  return icon;
};

const ProductCard: React.FC<ProductCardProps> = ({ product, denomination = '$' }) => {
  const truncatedDescription =
    typeof product.description === 'string' && product.description.length > 100
      ? product.description.substring(0, 97) + '...'
      : product.description;

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{
        display: 'flex',
        height: 'fit-content',
        maxHeight: '1in',
        overflow: 'hidden',
        marginBottom: '10px',
        flexDirection: 'row',
      }}
    >
      <a
        href={product.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none', color: 'inherit', display: 'flex', height: '100%' }}
      >
        <Image
          src={product.thumbnail}
          alt={product.name}
          fit="contain"
          style={{ width: '80px', height: '80px', maxWidth: '80px', flexShrink: 0 }}
        />
      </a>

      <Box
        style={{
          flexGrow: 1,
          paddingLeft: '10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="nowrap" style={{ width: '100%' }}>
          <HoverCard width={280} shadow="md" openDelay={300} closeDelay={100}>
            <HoverCard.Target>
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  flexGrow: 1,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                <Text
                  fw={700}
                  size="sm"
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                >
                  {product.name}
                </Text>
              </a>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <Text size="sm">{product.name}</Text>
            </HoverCard.Dropdown>
          </HoverCard>
          <Text fw={700} size="sm" style={{ marginLeft: '10px', flexShrink: 0 }}>
            {denomination}
            {product.price?.toFixed(2) || product.price}
          </Text>
        </Group>

        <Group gap="xs" align="normal" style={{ marginTop: 'auto' }}>
          <HoverCard width={280} shadow="md" openDelay={300} closeDelay={100}>
            <HoverCard.Dropdown>
              <Text size="sm">{product.brandEthicalStatus}</Text>
            </HoverCard.Dropdown>
            <HoverCard.Target>
              <span style={{ cursor: 'pointer' }}>
                {getEthicalIconBadge(product.brandEthicalStatus)}
              </span>
            </HoverCard.Target>
          </HoverCard>
          <Text size="xs" c="dimmed">
            {product.brand}
          </Text>

          <HoverCard width={280} shadow="md" openDelay={300} closeDelay={100}>
            <HoverCard.Target>
              <span style={{ cursor: 'pointer' }}>
                {getEthicalIconBadge(product.sellingCompanyEthicalStatus)}
              </span>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <Text size="sm">{product.sellingCompanyEthicalStatus}</Text>
            </HoverCard.Dropdown>
          </HoverCard>
          <Text size="xs" c="dimmed">{`via ${product.sellingCompany}`}</Text>
        </Group>

        {product.description && product.description !== 'N/A' && (
          <HoverCard width={280} shadow="md" openDelay={300} closeDelay={100}>
            <HoverCard.Target>
              <Text
                size="xs"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                hello i am a truncated description hello hello hello i am a truncated description
                hello hello hello i am a truncated description hello hello hello i am a truncated
                description hello hello
              </Text>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              {/* <Text size="sm">{product.description}</Text> */}
              <Text size="sm">hello i am a description hello hello</Text>
            </HoverCard.Dropdown>
          </HoverCard>
        )}
      </Box>
    </Card>
  );
};

export default ProductCard;
