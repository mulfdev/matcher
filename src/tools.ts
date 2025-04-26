export const toolMap = {
    get_weather: async (args: { city: string }) => {
        // Replace this with your actual weather-fetching logic
        return { temperature: '20°C', description: 'Sunny' };
    },
};

export const tools = [
    {
        type: 'function',
        function: {
            name: 'get_weather',
            description: 'Retrieve weather for a city',
            parameters: {
                type: 'object',
                properties: {
                    city: { type: 'string', description: 'City name' },
                },
                required: ['city'],
            },
        },
    },
];
