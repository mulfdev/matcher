import { useEffect, useState } from 'react';
import { fetcher } from '~/core';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '~/components/card';
import { Badge } from '~/components/badge';
import { Text } from '~/components/text';
import { Button } from '~/components/button';

interface JobMatch {
  id: string;
  title: string;
  location: string;
  compensation: string;
  summary: string;
  similarity: number;
}

interface MatchResponse {
  results: JobMatch[];
}

export default function DashboardMatches() {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatches() {
      try {
        setLoading(true);
        const response = await fetcher<MatchResponse>({ url: '/match-job' });
        setMatches(response.results);
      } catch (err) {
        console.error('Error fetching matches:', err);
        setError('Failed to load job matches. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchMatches();
  }, []);

  // Function to format compensation
  const formatCompensation = (compensation: string) => {
    if (!compensation) return 'Not specified';
    return compensation;
  };

  return (
    <div className="max-w-4xl mx-auto p-2 md:p-6">
      <h1 className="text-white text-3xl font-bold mb-6">Your Job Matches</h1>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-purple-400">Loading matches...</div>
        </div>
      ) : error ? (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="pt-6">
            <Text className="text-red-300">{error}</Text>
          </CardContent>
        </Card>
      ) : matches.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Text>
              No job matches found. Please complete your profile to get matched with jobs.
            </Text>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {matches.map((job) => (
            <Card
              key={job.id}
              className="overflow-hidden border-zinc-800 hover:border-purple-800 transition-colors duration-300"
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl text-white">{job.title}</CardTitle>
                    <div className="flex items-center mt-1 text-zinc-400 text-sm">
                      <span>{job.location}</span>
                      {job.compensation && (
                        <>
                          <span className="mx-2">•</span>
                          <span>{formatCompensation(job.compensation)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Text className="line-clamp-3 text-zinc-300">{job.summary}</Text>
              </CardContent>
              <CardFooter className="border-t border-zinc-800 bg-zinc-900/50 flex justify-between">
                <div className="text-sm text-zinc-400">ID: {job.id}</div>
                <Button color="indigo">View Details</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
