import { useEffect, useState } from 'react';
import { fetcher } from '~/core';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '~/components/card';
import { Text } from '~/components/text';
import { Button } from '~/components/button';
import clsx from 'clsx';

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
  const [submittingFeedbackFor, setSubmittingFeedbackFor] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, boolean>>({});
  const [totalRated, setTotalRated] = useState(0);
  const MAX_TOTAL = 21;

  const fetchMatches = async () => {
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
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  useEffect(() => {
    if (!loading && matches.length > 0 && Object.keys(feedbackMap).length === matches.length) {
      const newTotal = totalRated + matches.length;
      if (newTotal < MAX_TOTAL) {
        setTotalRated(newTotal);
        setFeedbackMap({});
        fetchMatches();
      } else {
        setTotalRated(newTotal);
      }
    }
  }, [feedbackMap, loading, matches, totalRated]);

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
      ) : totalRated >= MAX_TOTAL ? (
        <Card>
          <CardContent className="pt-6">
            <Text>
              You’ve reviewed all {MAX_TOTAL} job recommendations.
            </Text>
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
                <div className="flex items-center space-x-2">
                  <Button
                    color="green"
                    disabled={submittingFeedbackFor === job.id}
                    className={clsx(
                      feedbackMap[job.id] === true &&
                        'ring-2 ring-offset-2 ring-offset-zinc-900 ring-green-500'
                    )}
                    onClick={() => {
                      setError(null);
                      setSubmittingFeedbackFor(job.id);
                      fetcher({ method: 'POST', url: '/match-job/feedback', body: { id: job.id, liked: true } })
                        .catch((err) => {
                          console.error('Error submitting feedback:', err);
                          setError('Failed to submit feedback. Please try again.');
                        })
                        .finally(() => {
                          setSubmittingFeedbackFor(null);
                          setFeedbackMap((prev) => ({ ...prev, [job.id]: true }));
                        });
                    }}
                  >
                    👍
                  </Button>
                  <Button
                    color="red"
                    disabled={submittingFeedbackFor === job.id}
                    className={clsx(
                      feedbackMap[job.id] === false &&
                        'ring-2 ring-offset-2 ring-offset-zinc-900 ring-red-500'
                    )}
                    onClick={() => {
                      setError(null);
                      setSubmittingFeedbackFor(job.id);
                      fetcher({ method: 'POST', url: '/match-job/feedback', body: { id: job.id, liked: false } })
                        .catch((err) => {
                          console.error('Error submitting feedback:', err);
                          setError('Failed to submit feedback. Please try again.');
                        })
                        .finally(() => {
                          setSubmittingFeedbackFor(null);
                          setFeedbackMap((prev) => ({ ...prev, [job.id]: false }));
                        });
                    }}
                  >
                    👎
                  </Button>
                </div>
                <Button color="indigo">View Details</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
