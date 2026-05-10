import { Query } from 'mongoose';

interface QueryString {
    page?: string;
    sort?: string;
    limit?: string;
    fields?: string;
    search?: string;
    category?: string;
    [key: string]: string | undefined;
}

class ApiFeatures<T> {
    public query: Query<T[], T>;
    private queryString: QueryString;

    constructor(query: Query<T[], T>, queryString: QueryString) {
        this.query = query;
        this.queryString = queryString;
    }

    /** Full-text search on `name` and `description` fields */
    search(): this {
        if (this.queryString.search) {
            const regex = new RegExp(this.queryString.search, 'i');
            this.query = this.query.find({
                $or: [{ name: regex }, { description: regex }],
            } as Parameters<typeof this.query.find>[0]);
        }
        return this;
    }

    /** Filter by any field (excludes pagination/sort/fields) */
    filter(): this {
        const queryObj = { ...this.queryString };
        const excluded = ['page', 'sort', 'limit', 'fields', 'search'];
        excluded.forEach((el) => delete queryObj[el]);

        // Support advanced filtering: gte, gt, lte, lt → $gte, $gt …
        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

        this.query = this.query.find(JSON.parse(queryStr));
        return this;
    }

    sort(): this {
        if (this.queryString.sort) {
            const sortBy = this.queryString.sort.split(',').join(' ');
            this.query = this.query.sort(sortBy);
        } else {
            this.query = this.query.sort('-createdAt');
        }
        return this;
    }

    limitFields(): this {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',').join(' ');
            this.query = this.query.select(fields);
        } else {
            this.query = this.query.select('-__v');
        }
        return this;
    }

    paginate(): this {
        const page = parseInt(this.queryString.page || '1', 10);
        const limit = parseInt(this.queryString.limit || '12', 10);
        const skip = (page - 1) * limit;
        this.query = this.query.skip(skip).limit(limit);
        return this;
    }
}

export default ApiFeatures;
