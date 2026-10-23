/** Ready-made agents of the gallery. Their texts are translated in messages (gallery.items.<id>). */
export interface Example {
  id: 'support-bot' | 'hr-assistant' | 'devops-agent' | 'weather-agent';
  yaml: string;
}

export const EXAMPLES: readonly Example[] = [
  {
    id: 'support-bot',
    yaml: `agent:
  name: support-bot
  description: Answers customers and opens support tickets
  model:
    provider: mistral
    name: mistral-small-latest
    temperature: 0.2
  tools:
    - name: order-status
      type: http
      description: Status and delivery date of a customer order
      url: https://shop.example.org/api/orders/{orderId}
      auth: { type: bearer, env: SHOP_API_TOKEN }
      params:
        - { name: orderId, type: string, required: true, description: 'Order number, as printed on the invoice' }
    - name: create-ticket
      type: http
      method: POST
      description: Opens a ticket for a human agent when the question cannot be solved here
      url: https://support.example.org/api/tickets
      auth: { type: header, name: X-API-Key, env: SUPPORT_API_KEY }
      params:
        - { name: title, type: string, required: true }
        - { name: details, type: string, required: true }
        - { name: priority, type: integer, description: 1 (urgent) to 4 (low) }
  gdpr:
    euOnly: true
`,
  },
  {
    id: 'hr-assistant',
    yaml: `agent:
  name: hr-assistant
  description: Answers employees about their days off and books them
  model:
    provider: mistral
    name: mistral-large-latest
    temperature: 0.3
  tools:
    - name: leave-balance
      type: java
      description: Days off left for the current employee this year
    - name: book-leave
      type: java
      description: Books a day off for the current employee
      params:
        - { name: date, type: string, required: true, description: 'Day off, ISO-8601' }
        - { name: halfDay, type: boolean, description: Morning only }
  gdpr:
    euOnly: true
`,
  },
  {
    id: 'devops-agent',
    yaml: `agent:
  name: devops-agent
  description: Checks the status of the services the team depends on
  model:
    provider: openai
    name: gpt-5-mini
  memory:
    window: 10
  tools:
    - name: github-status
      type: http
      description: Current status of GitHub
      url: https://www.githubstatus.com/api/v2/status.json
    - name: deployment-history
      type: java
      description: Last deployments of a service, newest first
      params:
        - { name: service, type: string, required: true, description: 'Service name, as in the deployment tool' }
        - { name: limit, type: integer, description: How many deployments to list }
`,
  },
  {
    id: 'weather-agent',
    yaml: `agent:
  name: weather-agent
  description: Tells the current weather anywhere in the world
  model:
    provider: ollama
    name: qwen2.5:3b
    temperature: 0
  tools:
    - name: current-weather
      type: http
      description: Current temperature and wind speed at a location
      url: https://api.open-meteo.com/v1/forecast?current=temperature_2m,wind_speed_10m
      params:
        - { name: latitude, type: number, required: true, description: Latitude in degrees }
        - { name: longitude, type: number, required: true, description: Longitude in degrees }
`,
  },
];

export function exampleById(id: string | null): Example | undefined {
  return EXAMPLES.find((example) => example.id === id);
}
