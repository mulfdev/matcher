import { Badge } from '~/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/card';
import { Text } from '~/components/text';
import { ResumeData } from '~/types';

interface ResumeVisualizationProps {
  data: ResumeData;
  isLoading?: boolean;
}

export default function ResumeVisualization({ data, isLoading = false }: ResumeVisualizationProps) {
  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading resume data...</div>;
  }

  const getSkillColor = (index: number) => {
    const colors = [
      { bg: 'bg-purple-700', text: 'text-white' },
      { bg: 'bg-blue-600', text: 'text-white' },
      { bg: 'bg-emerald-600', text: 'text-white' },
      { bg: 'bg-amber-500', text: 'text-black' },
      { bg: 'bg-red-600', text: 'text-white' },
      { bg: 'bg-indigo-600', text: 'text-white' },
      { bg: 'bg-pink-600', text: 'text-white' },
      { bg: 'bg-teal-600', text: 'text-white' },
      { bg: 'bg-orange-500', text: 'text-black' },
      { bg: 'bg-cyan-600', text: 'text-white' },
    ];
    return colors[index % colors.length];
  };

  const getSkillSize = (index: number) => {
    const position = index / data.skills.length;

    if (position < 0.2) return 'text-base font-semibold sm:text-lg'; // Top 20% skills
    if (position < 0.5) return 'text-sm font-medium sm:text-base'; // Next 30% skills
    return 'text-xs sm:text-sm'; // Remaining 50% skills
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Resume Analysis</h1>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge color="emerald">
            {data.category
              .replace('/', ' / ')
              .split(' ')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')}
          </Badge>

          <Badge color="blue">
            {data.career_level.charAt(0).toUpperCase() + data.career_level.slice(1)}
          </Badge>
          <Badge color="purple">
            {+data.total_experience_years.toFixed(0) < 2
              ? `${data.total_experience_years.toFixed(0)} Year`
              : `${data.total_experience_years.toFixed(0)} Years`}{' '}
            Experience
          </Badge>
        </div>
      </div>

      {/* Summary Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Professional Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Text>{data.summary}</Text>
        </CardContent>
      </Card>

      {/* Skills Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Skills & Expertise</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {data.skills.map((skill, index) => {
                const { bg, text } = getSkillColor(index);
                return (
                  <div
                    key={skill}
                    className={`
                      ${getSkillSize(index)}
                      ${bg} ${text}
                      px-3 py-2 rounded-lg
                      shadow-sm flex items-center justify-center
                      cursor-default
                    `}
                  >
                    {skill}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Experience Timeline */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Professional Experience</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 ml-3 sm:ml-4"></div>

            {data.experience.map((job, index) => (
              <div key={index} className="mb-6 relative">
                <div className="flex">
                  {/* Timeline dot */}
                  <div className="absolute left-0 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-purple-600 mt-1.5 ml-2 sm:ml-2.5"></div>

                  {/* Content */}
                  <div className="ml-10 sm:ml-14">
                    <div className="flex flex-col mb-2">
                      <h3 className="text-lg sm:text-xl font-bold">{job.title}</h3>
                      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {job.start_date.substring(0, 7)} — {job.end_date}
                        <span className="ml-2 text-purple-500">({job.duration_months} months)</span>
                      </div>
                    </div>

                    <div className="text-base sm:text-lg font-medium mb-2">{job.company}</div>

                    <ul className="list-disc pl-4 space-y-1 text-sm sm:text-base">
                      {job.responsibilities.map((responsibility, idx) => (
                        <li key={idx} className="text-gray-700 dark:text-gray-300">
                          {responsibility}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
