import type { ProjectCreateInput } from '@docgraph/common/schemas'
import { Fragment } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { FormCheckbox } from '@/components/form/form-checkbox'
import { FormInput } from '@/components/form/form-input'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import { Field } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { useUserGetList } from '@/lib/api'

export type ProjectBaseFormProps = {
  isDialogOpen: boolean
}

export const ProjectBaseForm = ({ isDialogOpen }: ProjectBaseFormProps) => {
  const { control } = useFormContext<ProjectCreateInput>()
  const anchor = useComboboxAnchor()

  const { data: users = [] } = useUserGetList(isDialogOpen)

  return (
    <>
      <FormInput name='name' label='Name' />

      <FormCheckbox name='isForAllUsers' label='For All Users' />

      <Field>
        <Label htmlFor='memberIds'>Members</Label>
        <Controller
          control={control}
          name='memberIds'
          render={({ field: { value, onChange } }) => (
            <Combobox id='memberIds' items={users} multiple value={value} onValueChange={onChange}>
              <ComboboxChips ref={anchor} className='w-full'>
                <ComboboxValue>
                  {(values) => (
                    <Fragment>
                      {values.map((id: string) => (
                        <ComboboxChip key={id}>{users.find((u) => u.id === id)?.name}</ComboboxChip>
                      ))}
                      <ComboboxChipsInput />
                    </Fragment>
                  )}
                </ComboboxValue>
              </ComboboxChips>
              <ComboboxContent anchor={anchor}>
                <ComboboxEmpty>No users found.</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item.id} value={item.id}>
                      {item.name}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          )}
        />
      </Field>
    </>
  )
}
