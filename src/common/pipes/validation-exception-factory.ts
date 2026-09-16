import { ValidationError } from '@nestjs/common';
import { DomainException, ErrorDetail } from '../exceptions/domain.exception';

// Dipasang sebagai exceptionFactory pada ValidationPipe global — mengubah
// kegagalan class-validator menjadi envelope error VALIDATION_ERROR
// dengan detail per field (planbackend.md §6.2, §6.3).
export function validationExceptionFactory(
  errors: ValidationError[],
): DomainException {
  const details = flattenErrors(errors);
  return new DomainException(
    'VALIDATION_ERROR',
    undefined,
    details.length > 0 ? details : undefined,
  );
}

function flattenErrors(
  errors: ValidationError[],
  parentPath = '',
): ErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    const ownMessages: ErrorDetail[] = error.constraints
      ? Object.values(error.constraints).map((message) => ({
          field,
          message,
        }))
      : [];

    const childMessages = error.children?.length
      ? flattenErrors(error.children, field)
      : [];

    return [...ownMessages, ...childMessages];
  });
}
