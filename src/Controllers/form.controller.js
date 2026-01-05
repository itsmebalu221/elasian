import { formSchema } from '../Schemas/form.schema.js';
import { processFormSubmission } from '../Services/form.service.js';

export async function submitForm(req, res) {
  console.log('REQUEST BODY:', req.body);

  const parsed = formSchema.safeParse(req.body);
  console.log('PARSED RESULT:', parsed);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      errors: parsed.error.errors
    });
  }

  const result = await processFormSubmission(parsed.data);

  return res.json({
    success: true,
    data: result
  });
}
