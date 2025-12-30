import { formSchema } from '../Schemas/form.schema.js';
import { processFormSubmission } from '../Services/form.service.js';

export async function submitForm(request, reply) {
  console.log('REQUEST BODY:', request.body);

  const parsed = formSchema.safeParse(request.body);
  console.log('PARSED RESULT:', parsed);

  if (!parsed.success) {
    return reply.code(400).send({
      success: false,
      errors: parsed.error.errors
    });
  }

  const result = await processFormSubmission(parsed.data);

  return {
    success: true,
    data: result
  };
}
