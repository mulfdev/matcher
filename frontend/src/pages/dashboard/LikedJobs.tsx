import { useEffect, useState } from 'react';
import { fetcher } from '~/core';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '~/components/card';
import { Text } from '~/components/text';
import { Button } from '~/components/button';

interface LikedJob {
  id: string;
  title: string;
  location: string;
  compensation: string;
  summary: string;
}

interface LikedJobsResponse {
  results: LikedJob[];
}

export default function DashboardLikedJobs() {
  const [jobs, setJobs] = useState<LikedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLikedJobs = async () => {
    setLoading(true);
    try {
      const res = await fetcher<LikedJobsResponse>({ url: '/match-job/liked' });
      setJobs(res.results);
    } catch (err) {
      console.error('Error fetching liked jobs:', err);
      setError('Failed to load liked jobs. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLikedJobs();
  }, []);

  const formatCompensation = (comp: string) => comp || 'Not specified';

  return (
    <div className="max-w-4xl mx-auto p-2 md:p-6">
      <h1 className="text-white text-3xl font-bold mb-6">Liked Jobs</h1>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-purple-400">Loading liked jobs...</div>
        </div>
      ) : error ? (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="pt-6">
            <Text className="text-red-300">{error}</Text>
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Text>You haven't liked any jobs yet.</Text>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className="overflow-hidden border-zinc-800 hover:border-purple-800 transition-colors duration-300"
            >
              <CardHeader className="pb-2">
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
              </CardHeader>
              <CardContent>
                <Text className="line-clamp-3 text-zinc-300">{job.summary}</Text>
              </CardContent>
              <CardFooter className="border-t border-zinc-800 bg-zinc-900/50">
                <Button color="indigo">View Details</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}