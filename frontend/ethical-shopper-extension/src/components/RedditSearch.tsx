import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Text,
  TextInput,
  NumberInput,
  Select,
  Group,
  Stack,
  Badge,
  Anchor,
  Image,
  Loader,
  Alert,
} from '@mantine/core';
import { Search, ExternalLink, AlertCircle } from 'lucide-react';

interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  score: number;
  url: string;
  permalink: string;
  created_utc: number;
  num_comments: number;
  selftext: string | null;
  thumbnail: string | null;
}

interface RedditSearchResponse {
  success: boolean;
  data?: {
    query: string;
    subreddit: string;
    total_results: number;
    posts: RedditPost[];
  };
  error?: string;
}

export const RedditSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [subreddit, setSubreddit] = useState('');
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState('relevance');
  const [timeFilter, setTimeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RedditSearchResponse | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
        sort,
        t: timeFilter,
      });

      if (subreddit.trim()) {
        params.append('subreddit', subreddit);
      }

      const response = await fetch(`http://localhost:3000/reddit-search?${params}`);
      const data: RedditSearchResponse = await response.json();
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
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <Box p="md">
      <Text size="xl" fw={700} mb="md">
        Reddit Search API Tester
      </Text>

      <Card withBorder p="md" mb="md">
        <Stack gap="md">
          <TextInput
            label="Search Query"
            placeholder="Enter search terms..."
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            leftSection={<Search size={16} />}
          />

          <Group grow>
            <TextInput
              label="Subreddit (optional)"
              placeholder="e.g., programming, BuyItForLife"
              value={subreddit}
              onChange={(e) => setSubreddit(e.currentTarget.value)}
            />

            <NumberInput
              label="Limit"
              value={limit}
              onChange={(val) => setLimit(Number(val) || 10)}
              min={1}
              max={100}
            />
          </Group>

          <Group grow>
            <Select
              label="Sort"
              value={sort}
              onChange={(val) => setSort(val || 'relevance')}
              data={[
                { value: 'relevance', label: 'Relevance' },
                { value: 'hot', label: 'Hot' },
                { value: 'top', label: 'Top' },
                { value: 'new', label: 'New' },
                { value: 'comments', label: 'Comments' },
              ]}
            />

            <Select
              label="Time Filter"
              value={timeFilter}
              onChange={(val) => setTimeFilter(val || 'all')}
              data={[
                { value: 'all', label: 'All Time' },
                { value: 'year', label: 'Past Year' },
                { value: 'month', label: 'Past Month' },
                { value: 'week', label: 'Past Week' },
                { value: 'day', label: 'Past Day' },
                { value: 'hour', label: 'Past Hour' },
              ]}
            />
          </Group>

          <Button
            onClick={handleSearch}
            loading={loading}
            disabled={!query.trim()}
            leftSection={<Search size={16} />}
          >
            Search Reddit
          </Button>
        </Stack>
      </Card>

      {results && (
        <Card withBorder p="md">
          {results.success ? (
            <Stack gap="md">
              <Text size="lg" fw={600}>
                Search Results for "{results.data?.query}"
                {results.data?.subreddit !== 'all' && ` in r/${results.data?.subreddit}`}
              </Text>
              <Text size="sm" c="dimmed">
                Found {results.data?.total_results} results
              </Text>

              {results.data?.posts.map((post) => (
                <Card key={post.id} withBorder p="sm" radius="md">
                  <Group align="flex-start" gap="md">
                    {post.thumbnail && (
                      <Image
                        src={post.thumbnail}
                        alt="Thumbnail"
                        w={60}
                        h={60}
                        radius="sm"
                        fit="cover"
                      />
                    )}

                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Group justify="space-between">
                        <Badge variant="light" size="sm">
                          r/{post.subreddit}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {formatDate(post.created_utc)}
                        </Text>
                      </Group>

                      <Anchor href={post.url} target="_blank" size="sm" fw={600} lineClamp={2}>
                        {post.title}
                        <ExternalLink size={12} style={{ marginLeft: 4 }} />
                      </Anchor>

                      {post.selftext && (
                        <Text size="xs" c="dimmed" lineClamp={3}>
                          {post.selftext}
                        </Text>
                      )}

                      <Group gap="md">
                        <Text size="xs" c="dimmed">
                          👍 {post.score}
                        </Text>
                        <Text size="xs" c="dimmed">
                          💬 {post.num_comments}
                        </Text>
                        <Text size="xs" c="dimmed">
                          by u/{post.author}
                        </Text>
                        <Anchor href={post.permalink} target="_blank" size="xs">
                          View Comments
                        </Anchor>
                      </Group>
                    </Stack>
                  </Group>
                </Card>
              ))}
            </Stack>
          ) : (
            <Alert icon={<AlertCircle size={16} />} title="Error" color="red">
              {results.error}
            </Alert>
          )}
        </Card>
      )}
    </Box>
  );
};
