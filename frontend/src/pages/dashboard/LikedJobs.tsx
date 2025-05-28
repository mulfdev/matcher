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
  // Optionally, you could add a "reason" field in the future
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
      <h1 className="text-white text-4xl font-extrabold mb-8 tracking-tight flex items-center gap-3">
        <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-lg">
          Liked Jobs
        </span>
        <span className="inline-block animate-bounce text-2xl">💜</span>
      </h1>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-purple-400 text-xl font-semibold tracking-wide">
            Loading liked jobs...
          </div>
        </div>
      ) : error ? (
        <Card className="bg-gradient-to-r from-red-900/40 to-zinc-900/40 border-red-800 shadow-lg">
          <CardContent className="pt-6">
            <Text className="text-red-300">{error}</Text>
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card className="bg-gradient-to-r from-zinc-900/60 to-purple-900/40 border-purple-800 shadow-lg">
          <CardContent className="pt-6 flex flex-col items-center">
            <span className="text-4xl mb-2">🤔</span>
            <Text className="text-lg text-white font-semibold">
              You haven't liked any jobs yet.
            </Text>
            <Text className="text-zinc-400 mt-2">
              Start exploring matches and like jobs to see them here!
            </Text>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {jobs.map((job, idx) => (
            <Card
              key={job.id}
              className="overflow-hidden border-2 border-zinc-800 hover:border-purple-500 transition-colors duration-300 shadow-xl relative group bg-gradient-to-br from-zinc-900/80 via-zinc-950/90 to-purple-950/60"
              style={{
                boxShadow:
                  idx % 2 === 0
                    ? "0 4px 32px 0 rgba(168,85,247,0.10)"
                    : "0 4px 32px 0 rgba(99,102,241,0.10)",
              }}
            >
              <div className="absolute right-0 top-0 m-4">
                <span className="inline-block rounded-full bg-gradient-to-tr from-purple-500 via-pink-400 to-indigo-400 px-3 py-1 text-xs font-bold text-white shadow-md">
                  Liked #{idx + 1}
                </span>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl text-white font-bold flex items-center gap-2">
                  <span>{job.title}</span>
                </CardTitle>
                <div className="flex items-center mt-1 text-zinc-400 text-sm gap-2">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 12.414a4 4 0 1 0-1.414 1.414l4.243 4.243a1 1 0 0 0 1.414-1.414z"></path><path d="M15 11a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"></path></svg>
                    {job.location || <span className="italic text-zinc-500">Remote / Flexible</span>}
                  </span>
                  {job.compensation && (
                    <>
                      <span className="mx-2">•</span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"></path></svg>
                        {formatCompensation(job.compensation)}
                      </span>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Text className="line-clamp-4 text-zinc-200 text-base leading-relaxed">
                  {job.summary}
                </Text>
              </CardContent>
              <CardFooter className="border-t border-zinc-800 bg-zinc-900/60 flex justify-between items-center">
                <Button color="indigo" className="font-semibold shadow-md hover:scale-105 transition-transform duration-150">
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
