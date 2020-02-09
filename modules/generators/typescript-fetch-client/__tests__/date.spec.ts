test('date-time parsing', () => {
	expect(new Date('2020-01-03T11:23:45Z').toISOString()).toEqual('2020-01-03T11:23:45.000Z')
})

test('date parsing', () => {
	expect(new Date('2020-01-03').toISOString()).toEqual('2020-01-03T00:00:00.000Z')
	expect(new Date('2020-01-03').getFullYear()).toEqual(2020)
	expect(new Date('2020-01-03').getMonth()).toEqual(0)
	expect(new Date('2020-05-03').getMonth()).toEqual(4)
	expect(new Date('2020-01-03').getDate()).toEqual(3)
})

test('time parsing', () => {
	expect(new Date('1970-01-01T11:23:45Z').toISOString()).toEqual('1970-01-01T11:23:45.000Z')
	expect(new Date('1970-01-01T11:23:45').getHours()).toEqual(11)
	expect(new Date('1970-01-01T11:23:45').getMinutes()).toEqual(23)
	expect(new Date('1970-01-01T11:23:45').getSeconds()).toEqual(45)
})
