import { Badge } from '~/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/card';
import { Text } from '~/components/text';
import { ResumeData, Skill } from '~/types';

const skillCategories = {
  frontend: [
    'Typescript',
    'CSS',
    'Tailwind',
    'React',
    'Next.js',
    'SSR',
    'SSG',
    'Styled Components',
    'Cypress',
  ],
  backend: [
    'Node.js',
    'Express',
    'Go',
    'SQL',
    'Postgres',
    'MySQL',
    'MongoDB',
    'REST APIs',
    'WebSockets',
    'Jest',
  ],
  cloud: [
    'AWS CDK',
    'AWS Lambda',
    'AWS SQS',
    'AWS RDS',
    'AWS ECS',
    'AWS API Gateway',
    'DynamoDB',
    'AWS S3',
    'Digital Ocean',
    'Vercel',
    'CI/CD',
  ],
  blockchain: [
    'Solidity',
    'Hardhat',
    'Foundry',
    'Ethers.js',
    'Wagmi',
    'Blockchain APIs',
    'Smart Contract Development',
    'Hyperlane',
    'Ethereum',
    'Treasure Chain',
    'Solana',
    'NFT',
    'Subgraphs',
    'Mainnet',
  ],
  other: ['GitHub', 'DNS', 'Figma', 'Kafka'],
};

interface ResumeVisualizationProps {
  data: ResumeData;
}

export default function ResumeVisualization({ data }: ResumeVisualizationProps) {
  const categorizeSkills = (skills: Skill[]) => {
    const categorized: Record<string, Skill[]> = {
      frontend: [],
      backend: [],
      cloud: [],
      blockchain: [],
      other: [],
    };

    skills.forEach((skill) => {
      let found = false;
      for (const [category, categorySkills] of Object.entries(skillCategories)) {
        if (categorySkills.includes(skill)) {
          categorized[category].push(skill);
          found = true;
          break;
        }
      }
      if (!found) {
        categorized.other.push(skill);
      }
    });

    return categorized;
  };

  const categorizedSkills = categorizeSkills(data.skills);

  return (
    <div className="w-full px-2 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-3">Resume Analysis</h1>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge color="blue">
            {data.career_level.charAt(0).toUpperCase() + data.career_level.slice(1)} Level
          </Badge>
          <Badge color="purple">{data.total_experience_years.toFixed(1)} Years Experience</Badge>
          <Badge color="emerald">
            {data.category
              .replace('/', ' / ')
              .split(' ')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')}
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

      {/* Career Metrics - Moved up for better mobile experience */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Career Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
              <div className="text-3xl sm:text-4xl font-bold text-purple-600 mb-1">
                {data.total_experience_years.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Years of Experience</div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
              <div className="text-3xl sm:text-4xl font-bold text-purple-600 mb-1">
                {data.skills.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Technical Skills</div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
              <div className="text-3xl sm:text-4xl font-bold text-purple-600 mb-1">
                {data.experience.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Companies</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Skills & Technologies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(categorizedSkills).map(
              ([category, skills]) =>
                skills.length > 0 && (
                  <div key={category} className="space-y-2">
                    <h3 className="text-lg font-semibold capitalize">{category}</h3>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <Badge
                          key={skill}
                          color={
                            category === 'frontend'
                              ? 'sky'
                              : category === 'backend'
                                ? 'emerald'
                                : category === 'cloud'
                                  ? 'amber'
                                  : category === 'blockchain'
                                    ? 'purple'
                                    : 'zinc'
                          }
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )
            )}
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
