export async function load({ params }: { params: { userId: string } }) {
	return {
		userId: params.userId
	};
}

