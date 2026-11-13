import {
  API_KEY_MAX_EXPIRATION_DAYS,
  type ApiKey,
  type ApiKeyCreateInput,
  apiKeyCreateInputSchema,
  apiKeyDateInDays,
  UNRESTRICTED_API_KEY,
} from '@docgraph/common/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { FormCheckbox } from '@/components/form/form-checkbox'
import { FormInput } from '@/components/form/form-input'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { toast } from '@/components/ui/toast'
import { useApiKeyCreate, useApiKeyDelete, useApiKeyGetList, useProjectGetList } from '@/lib/api'
import { showErrorToast } from '@/lib/error-toast'
import { formatDate } from '@/lib/utils'
import { ApiKeyScopeField } from './api-key-scope-field'
import { describeApiKeyAccess, describeApiKeyExpiry } from './api-keys.helpers'
import { CreatedApiKeyDialog } from './created-api-key-dialog'

const DEFAULT_VALUES: ApiKeyCreateInput = {
  name: '',
  expiresOn: '',
  restrictions: UNRESTRICTED_API_KEY,
}

/**
 * Personal API keys for the MCP endpoint, so AI agents can read and update
 * diagrams on the user's behalf.
 */
export const ApiKeysSection = () => {
  const { data: apiKeys } = useApiKeyGetList()
  const hasRestrictedKeys = Boolean(apiKeys?.some((apiKey) => apiKey.restrictions.projects))
  const { data: projects = [] } = useProjectGetList(hasRestrictedKeys)
  const projectNames = new Map(projects.map((project) => [project.id, project.name]))
  const { mutate: create, isPending: isCreating } = useApiKeyCreate()
  const { mutate: remove, isPending: isDeleting } = useApiKeyDelete()
  const [createdKey, setCreatedKey] = useState<string>()
  const [keyToDelete, setKeyToDelete] = useState<ApiKey>()
  const form = useForm<ApiKeyCreateInput>({
    resolver: zodResolver(apiKeyCreateInputSchema),
    defaultValues: DEFAULT_VALUES,
  })
  const expiresOn = useWatch({ control: form.control, name: 'expiresOn' })

  const onSubmit = (data: ApiKeyCreateInput) => {
    if (isCreating) return

    create(data, {
      onError: (error) => showErrorToast('Could not create the API key', error),
      onSuccess: ({ key }) => {
        setCreatedKey(key)
        // React Compiler memoizes `register`, so inputs would not re-register after a plain reset
        form.reset(undefined, { keepFieldsRef: true })
      },
    })
  }

  const onDelete = () => {
    if (!keyToDelete || isDeleting) return

    remove(keyToDelete.id, {
      onError: (error) => showErrorToast('Could not revoke the API key', error),
      onSuccess: () => {
        setKeyToDelete(undefined)
        toast.add({ type: 'success', title: 'API key revoked' })
      },
    })
  }

  return (
    <section className='flex flex-col gap-3'>
      <div>
        <h3 className='font-semibold'>AI agents (MCP)</h3>
        <p className='text-sm text-muted-foreground'>
          API keys let AI agents such as Claude Code or Cursor read and update your diagrams and
          documents, e.g. to turn a database diagram into migrations or document a codebase.
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-2 md:items-start'>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='flex flex-col gap-3'>
            <FormInput<ApiKeyCreateInput>
              name='name'
              label='Name'
              placeholder='Key name, e.g. laptop'
            />
            <Field>
              <FieldLabel htmlFor='expiresOn'>Expires on (leave empty to never expire)</FieldLabel>
              <div className='flex items-start gap-1'>
                <div className='min-w-0 flex-1'>
                  <FormInput<ApiKeyCreateInput>
                    name='expiresOn'
                    type='date'
                    min={apiKeyDateInDays(1)}
                    max={apiKeyDateInDays(API_KEY_MAX_EXPIRATION_DAYS)}
                  />
                </div>
                {/* Always rendered so the date input doesn't change width when a date is picked */}
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label='Clear the expiry date'
                  disabled={!expiresOn}
                  className='disabled:invisible'
                  onClick={() => form.setValue('expiresOn', '', { shouldValidate: true })}
                >
                  <X />
                </Button>
              </div>
            </Field>
            <FormCheckbox<ApiKeyCreateInput>
              name='restrictions.readOnly'
              label='Read-only (agents can read but not create or change anything)'
            />
            <ApiKeyScopeField />
            <Button type='submit' disabled={isCreating} className='self-start'>
              Create API key
            </Button>
          </form>
        </FormProvider>

        <div className='flex flex-col gap-3'>
          {apiKeys && apiKeys.length > 0 ? (
            <ul className='flex max-h-60 flex-col divide-y overflow-y-auto rounded-lg border md:max-h-[28rem]'>
              {apiKeys.map((apiKey) => (
                <li key={apiKey.id} className='flex items-center gap-2 px-3 py-2'>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>{apiKey.name}</p>
                    <p className='text-xs text-muted-foreground my-px'>
                      Created {formatDate(apiKey.createdAt)}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Last used {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : 'never'}
                    </p>
                    <p className='text-xs text-muted-foreground my-px'>
                      {describeApiKeyAccess(apiKey.restrictions, projectNames)}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {describeApiKeyExpiry(apiKey.expiresAt)}
                    </p>
                  </div>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    aria-label={`Revoke ${apiKey.name}`}
                    onClick={() => setKeyToDelete(apiKey)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
              No API keys yet.
            </p>
          )}
        </div>
      </div>

      <CreatedApiKeyDialog apiKey={createdKey} onClose={() => setCreatedKey(undefined)} />
      <ConfirmDeleteDialog
        open={Boolean(keyToDelete)}
        onOpenChange={(open) => !open && setKeyToDelete(undefined)}
        description={`Agents using "${keyToDelete?.name}" will lose access immediately.`}
        onDelete={onDelete}
        isDeleting={isDeleting}
      />
    </section>
  )
}
