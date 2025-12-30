import { z } from 'zod/v4';

export const formSchema = z.object({
  name: z.string().min(2, 'Name too short'),
  email: z.string().email('Invalid email'),
  message: z.string().min(5).max(500)
});
