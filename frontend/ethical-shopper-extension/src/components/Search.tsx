import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Text,
  TextInput,
  NumberInput,
  Group,
  Stack,
  Badge,
  Anchor,
  Alert,
} from '@mantine/core';
import { Search as SearchIcon, ExternalLink, AlertCircle } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  domain: string;
  source: string;
  score: number;
  url: string;
  permalink: string;
  created_utc: number;
  num_comments: number;
  snippet: string | null;
  thumbnail: string | null;
}

interface EthicalSearchResponse {
  success: boolean;
  data?: {
    query: string;
    source: string;
    total_results: number;
    results: SearchResult[];
    ai_summary?: string | null;
    scraped_urls?: number;
  };
  error?: string;
}

export const Search: React.FC = () => {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EthicalSearchResponse | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
      });

      const response = await fetch(`http://localhost:3000/google-search?${params}`);
      const data: EthicalSearchResponse = await response.json();
      setResults(data);
    } catch (error) {
      setResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return 'Unknown date';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const getDomainColor = (domain: string) => {
    switch (domain) {
      case 'reddit.com':
        return 'orange';
      case 'quora.com':
        return 'red';
      case 'goodonyou.eco':
        return 'green';
      case 'ethicalelephant.com':
        return 'blue';
      default:
        return 'gray';
    }
  };

  return (
    <Box p="md">
      <Text size="xl" fw={700} mb="md">
        Ethical Shopping Search
      </Text>

      <Card withBorder p="md" mb="md">
        <Stack gap="md">
          <TextInput
            label="Search Query"
            placeholder="Enter search terms for ethical shopping advice..."
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            leftSection={<SearchIcon size={16} />}
          />

          <NumberInput
            label="Number of Results"
            value={limit}
            onChange={(val) => setLimit(Number(val) || 10)}
            min={1}
            max={100}
            description="Searches across multiple ethical shopping resources"
          />

          <Button
            onClick={handleSearch}
            loading={loading}
            disabled={!query.trim()}
            leftSection={<SearchIcon size={16} />}
          >
            Search
          </Button>
        </Stack>
      </Card>

      {results && (
        <Card withBorder p="md">
          {results.success ? (
            <Stack gap="md">
              <Text size="lg" fw={600}>
                Search Results for "{results.data?.query}"
              </Text>
              <Text size="sm" c="dimmed">
                Found {results.data?.total_results} results across ethical shopping resources
                {results.data?.scraped_urls &&
                  results.data.scraped_urls > 0 &&
                  ` • Analyzed content from ${results.data.scraped_urls} pages`}
              </Text>

              {/* AI Summary Section */}
              {results.data?.ai_summary && (
                <Card withBorder p="md" radius="md" style={{ backgroundColor: '#f8f9fa' }}>
                  <Stack gap="sm">
                    <Group gap="xs">
                      <Text size="md" fw={600} c="blue">
                        🤖 AI-Generated Recommendations
                      </Text>
                      <Badge size="xs" variant="light" color="blue">
                        Powered by Gemini
                      </Badge>
                    </Group>
                    <Text size="sm" style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                      {results.data.ai_summary}
                    </Text>
                  </Stack>
                </Card>
              )}

              {/* Search Results */}
              <Text size="md" fw={600} mt="md">
                📄 Source Articles
              </Text>

              {results.data?.results.map((result) => (
                <Card key={result.id} withBorder p="sm" radius="md">
                  <Group align="flex-start" gap="md">
                    {result.thumbnail && (
                      <img
                        src={result.thumbnail}
                        alt=""
                        style={{
                          width: 60,
                          height: 60,
                          objectFit: 'cover',
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Group justify="space-between">
                        <Badge variant="light" size="sm" color={getDomainColor(result.domain)}>
                          {result.domain}
                        </Badge>
                        {result.created_utc > 0 && (
                          <Text size="xs" c="dimmed">
                            {formatDate(result.created_utc)}
                          </Text>
                        )}
                      </Group>

                      <Anchor href={result.url} target="_blank" size="sm" fw={600} lineClamp={2}>
                        {result.title}
                        <ExternalLink size={12} style={{ marginLeft: 4 }} />
                      </Anchor>

                      {result.snippet && (
                        <Text size="xs" c="dimmed" lineClamp={3}>
                          {result.snippet}
                        </Text>
                      )}

                      <Group gap="md">
                        <Text size="xs" c="dimmed">
                          🌐 {result.source}
                        </Text>
                        {result.score > 0 && (
                          <Text size="xs" c="dimmed">
                            👍 {result.score}
                          </Text>
                        )}
                        {result.num_comments > 0 && (
                          <Text size="xs" c="dimmed">
                            💬 {result.num_comments}
                          </Text>
                        )}
                      </Group>
                    </Stack>
                  </Group>
                </Card>
              ))}

              {results.data?.results.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  No results found. Try different search terms.
                </Text>
              )}
            </Stack>
          ) : (
            <Alert icon={<AlertCircle size={16} />} title="Search Error" color="red">
              {results.error}
            </Alert>
          )}
        </Card>
      )}
    </Box>
  );
};
